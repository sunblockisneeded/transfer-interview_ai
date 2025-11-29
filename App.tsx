import React, { useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { AnalysisStep, StepStatus, FullReport, ValidationResult, ResearchResult, ProfessorAnalysisResult } from './types';
import { validateUniversityAndDepartment, researchCurriculum, researchProfessorsAndKnowledge, researchInterviewTrends, synthesizeStrategy } from './services/geminiService';
import ProgressSteps from './components/ProgressSteps';
import DetailView from './components/DetailView';
import OverallView from './components/OverallView';
import QuestionsView from './components/QuestionsView';
import Sidebar from './components/Sidebar';
import SearchSection from './components/SearchSection';
import { LayoutDashboard, Layers, MessageSquare, PauseCircle, PlayCircle, RotateCcw } from 'lucide-react';
import { analysisRateLimiter } from './utils/rateLimiter';

const INITIAL_STEPS: AnalysisStep[] = [
  { id: 'research', label: 'Parallel Research', status: StepStatus.IDLE },
  { id: 'review', label: 'Review & Format', status: StepStatus.IDLE },
  { id: 'synthesis', label: 'Strategy Synthesis', status: StepStatus.IDLE },
];

enum Tab {
  DETAIL = 'Detail Analysis',
  OVERALL = 'Overall Strategy',
  QUESTIONS = 'Expected Questions'
}

interface ResearchCache {
  curriculum: ResearchResult;
  professors: ProfessorAnalysisResult;
  trends: ResearchResult;
}

function App() {
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>(INITIAL_STEPS);
  const [report, setReport] = useState<FullReport | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.OVERALL);
  const [validationError, setValidationError] = useState<ValidationResult | null>(null);
  const [researchCache, setResearchCache] = useState<ResearchCache | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const updateStep = (id: string, status: StepStatus) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    if (window.confirm("초기 화면으로 돌아가시겠습니까? 현재 분석된 내용은 사라집니다.")) {
      setReport(null);
      setUniversity('');
      setDepartment('');
      setSteps(INITIAL_STEPS);
      setValidationError(null);
      setActiveTab(Tab.OVERALL);
      setResearchCache(null);
      scrollToTop();
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsAnalyzing(false);

    // Mark current loading step as PAUSED
    setSteps(prev => prev.map(s =>
      s.status === StepStatus.LOADING ? { ...s, status: StepStatus.PAUSED } : s
    ));
  };

  const handleValidationAndAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!university || !department) return;

    setValidationError(null);
    setRateLimitError(null);
    setIsValidating(true);
    setResearchCache(null); // Clear cache on new search

    // Check rate limit (Client-side check, server also has one)
    if (!analysisRateLimiter.check()) {
      const retryAfter = Math.ceil(analysisRateLimiter.getRetryAfter() / 1000);
      setRateLimitError(`요청이 너무 많습니다. ${retryAfter}초 후에 다시 시도해주세요.`);
      setIsValidating(false);
      return;
    }

    try {
      // 1. Validate Input
      const inputRegex = /^[a-zA-Z0-9\s\u3131-\uD79D]+$/; // Allow Korean, English, Numbers, Spaces
      if (!inputRegex.test(university) || !inputRegex.test(department)) {
        setValidationError({
          isValid: false,
          isTypo: false,
          message: "특수문자나 허용되지 않은 문자가 포함되어 있습니다."
        });
        setIsValidating(false);
        return;
      }

      const validation = await validateUniversityAndDepartment(university, department);

      if (!validation.isValid) {
        setValidationError(validation);
        setIsValidating(false);
        return;
      }

      if (validation.isTypo && validation.correctedUniversity) {
        setValidationError(validation);
        setIsValidating(false);
        return; // Wait for user confirmation
      }

      // Proceed if valid
      startAnalysis(university, department);

    } catch (error) {
      console.error("Validation check failed, proceeding with caution", error);
      startAnalysis(university, department);
    }
  };

  const confirmCorrection = () => {
    if (validationError?.correctedUniversity) setUniversity(validationError.correctedUniversity);
    if (validationError?.correctedDepartment) setDepartment(validationError.correctedDepartment);
    setValidationError(null);
    // Automatically start with corrected values
    startAnalysis(
      validationError?.correctedUniversity || university,
      validationError?.correctedDepartment || department
    );
  };

  const startAnalysis = async (uni: string, dept: string, useCache = false) => {
    setIsAnalyzing(true);
    setIsValidating(false);
    setReport(null);
    setActiveTab(Tab.OVERALL); // Ensure it switches to Overall view when analysis starts/restarts

    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let currentCurriculum = researchCache?.curriculum;
      let currentProfessors = researchCache?.professors;
      let currentTrends = researchCache?.trends;

      // --- STEP 1: RESEARCH ---
      if (!useCache || !researchCache) {
        setSteps(INITIAL_STEPS); // Reset UI steps
        updateStep('research', StepStatus.LOADING);

        const [curriculumData, professorData, trendsData] = await Promise.all([
          researchCurriculum(uni, dept),
          researchProfessorsAndKnowledge(uni, dept),
          researchInterviewTrends(uni, dept)
        ]);

        if (controller.signal.aborted) return;

        currentCurriculum = curriculumData;
        currentProfessors = professorData;
        currentTrends = trendsData;

        // Save to cache
        setResearchCache({
          curriculum: curriculumData,
          professors: professorData,
          trends: trendsData
        });

        updateStep('research', StepStatus.COMPLETED);
      } else {
        // Recovering from cache
        setSteps(prev => prev.map(s => {
          if (s.id === 'research') return { ...s, status: StepStatus.COMPLETED };
          if (s.id === 'review' || s.id === 'synthesis') return { ...s, status: StepStatus.IDLE };
          return s;
        }));
      }

      if (!currentCurriculum || !currentProfessors || !currentTrends) {
        throw new Error("Research data missing");
      }

      // --- STEP 2: REVIEW ---
      updateStep('review', StepStatus.LOADING);
      await new Promise(resolve => setTimeout(resolve, 800));
      if (controller.signal.aborted) return;
      updateStep('review', StepStatus.COMPLETED);

      // --- STEP 3: SYNTHESIS ---
      updateStep('synthesis', StepStatus.LOADING);
      const strategyData = await synthesizeStrategy(
        uni,
        dept,
        currentCurriculum.text,
        currentProfessors.professors,
        currentTrends.text,
        controller.signal
      );

      if (controller.signal.aborted) return;
      updateStep('synthesis', StepStatus.COMPLETED);

      setReport({
        university: uni,
        department: dept,
        curriculumAnalysis: currentCurriculum,
        professorAnalysis: currentProfessors,
        interviewTrends: currentTrends,
        strategy: strategyData
      });

    } catch (error: any) {
      if (error.message === "ABORTED") {
        console.log("Analysis aborted by user");
        // Steps are already updated in handleStop
      } else {
        console.error("Analysis failed", error);
        updateStep('research', StepStatus.ERROR);
        updateStep('synthesis', StepStatus.ERROR);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setIsAnalyzing(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleDownload = () => {
    if (!report) return;

    // Simple Markdown to HTML converter for export
    const mdToHtml = (md: string) => {
      if (!md) return '';
      return md
        .replace(/^# (.*$)/gim, '<h1 style="font-family: \'Noto Serif KR\', serif; font-size: 24px; color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 30px;">$1</h1>')
        .replace(/^## (.*$)/gim, '<h2 style="font-family: \'Noto Serif KR\', serif; font-size: 20px; color: #1e293b; margin-top: 25px;">$1</h2>')
        .replace(/^### (.*$)/gim, '<h3 style="font-family: \'Noto Serif KR\', serif; font-size: 18px; color: #334155; margin-top: 20px;">$1</h3>')
        .replace(/^\d+\. (.*$)/gim, '<div style="margin-left: 20px; margin-bottom: 5px;"><b>$1</b></div>') // Numbered lists as bold lines
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\n/gim, '<br />');
    };

    const professorsHtml = report.professorAnalysis.professors?.map(p => `
      <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 15px; background-color: #f8fafc;">
        <h3 style="margin: 0; color: #1e293b; font-family: 'Noto Serif KR', serif;">${p.name}</h3>
        <p style="margin: 5px 0; color: #64748b; font-size: 14px;">${p.lab || ''} | ${p.contact || ''}</p>
        <div style="margin-top: 10px; font-style: italic; color: #4f46e5;">"${p.researchTendency}"</div>
        <div style="margin-top: 10px;">
          <strong>Recent Papers:</strong>
          <ul style="margin: 5px 0; padding-left: 20px; color: #475569;">
            ${p.majorPapers?.map(paper => `<li>${paper}</li>`).join('') || ''}
          </ul>
        </div>
        ${p.details ? `<p style="margin-top: 10px; font-size: 14px; color: #64748b;">${p.details}</p>` : ''}
      </div>
    `).join('') || '<p>교수진 정보가 없습니다.</p>';

    const conceptsHtml = report.strategy.coreConcepts?.map((c, i) => `
      <div style="margin-bottom: 15px; padding: 10px; border-left: 4px solid #6366f1; background-color: #f8fafc;">
        <strong style="color: #4338ca; font-size: 16px; font-family: 'Noto Serif KR', serif;">${i + 1}. ${c.keyword}</strong>
        <p style="margin: 5px 0;">${c.description}</p>
        <p style="margin: 5px 0; color: #4338ca;"><i>Example: ${c.example}</i></p>
      </div>
    `).join('') || '<p>핵심 키워드가 없습니다.</p>';

    const questionsHtml = (questions: any[], type: string, color: string) => `
      <h3 style="color: ${color}; margin-top: 20px; font-family: 'Noto Serif KR', serif;">${type} Difficulty</h3>
      ${questions && questions.length > 0 ? questions.map((q, i) => `
        <div style="margin-bottom: 15px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="font-weight: bold; margin-bottom: 5px;">Q${i + 1}. ${q.question}</div>
          <div style="font-size: 14px; color: #475569; margin-bottom: 5px;">Intent: ${q.intent}</div>
          <div style="font-size: 14px; background-color: #f1f5f9; padding: 8px; border-radius: 4px;">Tip: ${q.tip}</div>
        </div>
      `).join('') : '<p>질문이 생성되지 않았습니다.</p>'}
    `;

    const htmlContent = DOMPurify.sanitize(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.university} ${report.department} Analysis Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&display=swap');
          body { font-family: 'Noto Serif KR', serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px; }
          h1 { color: #1e1b4b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .section { margin-bottom: 40px; }
          .badge { background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="border: none; margin-bottom: 10px;">${report.university} ${report.department}</h1>
          <p style="font-size: 18px; color: #64748b;">TransferPrep AI Analysis Report</p>
          <p style="font-size: 14px; color: #94a3b8;">Date: ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="section">
          <h1>1. Detailed Analysis</h1>
          
          <h2>Curriculum & Trends</h2>
          ${mdToHtml(report.curriculumAnalysis.text)}

          <h2>Professors</h2>
          ${professorsHtml}

          <h2>Major Knowledge</h2>
          ${mdToHtml(report.professorAnalysis.majorKnowledgeAnalysis)}

          <h2>Interview Trends & Cases</h2>
          ${mdToHtml(report.interviewTrends.text)}
        </div>

        <div class="section">
          <h1>2. Overall Strategy</h1>
          <div style="padding: 20px; background-color: #f0f9ff; border-radius: 8px; margin-bottom: 20px;">
            <p style="white-space: pre-wrap;">${report.strategy.coreStrategy || '전략이 없습니다.'}</p>
          </div>
          <h2>Core Concepts</h2>
          ${conceptsHtml}
        </div>

        <div class="section">
          <h1>3. Predicted Questions</h1>
          ${questionsHtml(report.strategy.questions?.high, 'High', '#dc2626')}
          ${questionsHtml(report.strategy.questions?.medium, 'Medium', '#d97706')}
          ${questionsHtml(report.strategy.questions?.low, 'Low', '#16a34a')}
        </div>
      </body>
      </html>
    `);

    const blob = new Blob([String(htmlContent)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.university}_${report.department}_Report.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showRetry = !isAnalyzing && researchCache && !report;

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans">

      <Sidebar
        university={university}
        department={department}
        report={report}
        onReset={handleReset}
        onDownload={handleDownload}
        onScrollToTop={scrollToTop}
      />

      {/* --- Main Content --- */}
      <main className="flex-1 min-w-0 overflow-auto bg-[#f8fafc]">

        {/* Mobile Header */}
        <div className="md:hidden bg-[#0f172a] text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <PlayCircle className="text-indigo-500 w-5 h-5" />
            <span className="font-playfair font-bold text-lg">TransferPrep AI</span>
          </div>
          {(university || department) && (
            <button onClick={handleReset} className="p-2 text-slate-400 hover:text-white">
              <RotateCcw className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">

          {/* Landing / Search Section */}
          {!report && !isAnalyzing && !isValidating && !showRetry && (
            <SearchSection
              university={university}
              setUniversity={setUniversity}
              department={department}
              setDepartment={setDepartment}
              onAnalyze={handleValidationAndAnalyze}
              validationError={validationError}
              setValidationError={setValidationError}
              rateLimitError={rateLimitError}
              setRateLimitError={setRateLimitError}
              onConfirmCorrection={confirmCorrection}
              onProceedAnyway={() => { setValidationError(null); startAnalysis(university, department); }}
            />
          )}

          {/* Loading / Progress / Retry State */}
          {(isAnalyzing || showRetry || isValidating) && !report && (
            <div className="max-w-3xl mx-auto pt-20 text-center animate-in fade-in duration-500">
              {isAnalyzing && (
                <>
                  <div className="mb-8 font-serif-kr">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {university} {department} 분석 중...
                    </h3>
                    <p className="text-slate-500">잠시만 기다려주세요. AI가 데이터를 수집하고 있습니다.</p>
                  </div>
                  <ProgressSteps steps={steps} />
                  <button
                    type="button"
                    onClick={handleStop}
                    className="mt-8 bg-white hover:bg-red-50 text-red-600 font-medium py-2 px-6 rounded-full border border-red-200 transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    <PauseCircle className="w-5 h-5" /> 분석 중지
                  </button>
                </>
              )}

              {isValidating && (
                <div className="flex flex-col items-center justify-center py-20 font-serif-kr">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <h3 className="text-xl font-bold text-slate-800">학교 정보를 확인하고 있습니다...</h3>
                </div>
              )}

              {showRetry && (
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-100 max-w-xl mx-auto font-serif-kr">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">분석이 중단되었습니다</h3>
                  <p className="text-slate-500 mb-6">
                    기존 연구 데이터(1단계)는 안전하게 저장되어 있습니다.<br />
                    전략 생성 단계부터 다시 시작하시겠습니까?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => startAnalysis(university, department, true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center justify-center gap-2"
                    >
                      <PlayCircle className="w-5 h-5" /> 이어서 분석하기 (Retry)
                    </button>
                    <button
                      onClick={handleReset}
                      className="bg-white border border-slate-300 text-slate-600 font-bold py-3 px-6 rounded-xl hover:bg-slate-50"
                    >
                      처음부터 다시
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results View - Classy Serif Font Applied */}
          {report && (
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 font-serif-kr">
              <div className="text-center mb-10">
                <h2 className="text-4xl md:text-5xl font-bold text-[#1e293b] mb-3 tracking-tight leading-tight">{report.university}</h2>
                <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-800 font-semibold rounded-full text-lg border border-indigo-100">
                  {report.department} 분석 보고서
                </div>
              </div>

              {/* Tabs */}
              <div className="flex justify-center border-b border-slate-200 mb-10 sticky top-0 bg-[#f8fafc]/95 backdrop-blur-sm z-40 pt-2 transition-all">
                <div className="flex gap-4 md:gap-8 overflow-x-auto px-4 pb-0.5 no-scrollbar w-full md:w-auto justify-start md:justify-center">
                  {[
                    { id: Tab.OVERALL, icon: LayoutDashboard },
                    { id: Tab.DETAIL, icon: Layers },
                    { id: Tab.QUESTIONS, icon: MessageSquare }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-4 border-b-2 font-bold text-sm transition-all whitespace-nowrap ${activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === Tab.DETAIL && (
                  <DetailView report={report} />
                )}
                {activeTab === Tab.OVERALL && (
                  <OverallView strategy={report.strategy} />
                )}
                {activeTab === Tab.QUESTIONS && (
                  <QuestionsView strategy={report.strategy} />
                )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
