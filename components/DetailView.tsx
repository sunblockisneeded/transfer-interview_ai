
import React, { useState } from 'react';
import { FullReport } from '../types';
import MarkdownContent from './MarkdownContent';
import ProfessorList from './ProfessorList';
import { List } from 'lucide-react';

interface DetailViewProps {
  report: FullReport;
}

const DetailView: React.FC<DetailViewProps> = ({ report }) => {
  const [activeSection, setActiveSection] = useState<string>('');

  const sections = [
    { id: 'section-1', label: '1. 교과과정-해당학교' },
    { id: 'section-2', label: '2. 교과과정' },
    { id: 'section-3', label: '3. 교수진 분석' },
    { id: 'section-4', label: '4. 전공지식' },
    { id: 'section-5', label: '5. 합격사례-해당학과' },
    { id: 'section-6', label: '6. 합격사례-해당학교/학과' },
    { id: 'section-7', label: '7. 불합격-해당학과' },
    { id: 'section-8', label: '8. 불합격-해당학교' },
    { id: 'section-9', label: '9. 실전사례' },
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  const SectionDivider = () => (
    <hr className="my-12 border-t border-slate-200" />
  );

  return (
    <div className="relative animate-in fade-in duration-500 font-serif-kr">
      
      {/* Table of Contents - Non-sticky */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-5 mb-10">
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
           <List className="w-4 h-4 text-slate-500" />
           <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">Table of Contents</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className="px-3 py-1.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* 1 & 2. Curriculum Analysis */}
        <section>
          <MarkdownContent 
            content={report.curriculumAnalysis.text} 
            sources={report.curriculumAnalysis.sources} 
          />
        </section>

        <SectionDivider />

        {/* 3. Professor Analysis */}
        <section id="section-3" className="scroll-mt-32">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm mb-6">
            <h2 className="text-3xl font-bold text-[#1e293b] mb-6 pb-3 border-b border-slate-300 flex items-center gap-2 font-serif-kr">
              <span className="text-indigo-600">3.</span> {report.university} {report.department} 교수진 분석
            </h2>
            <ProfessorList 
              professors={report.professorAnalysis.professors} 
              sources={report.professorAnalysis.sources} 
            />
          </div>
        </section>

        <SectionDivider />

        {/* 4. Major Knowledge Analysis */}
        <section className="scroll-mt-32">
          <MarkdownContent content={report.professorAnalysis.majorKnowledgeAnalysis} />
        </section>

        <SectionDivider />

        {/* 5-9. Interview Trends & Cases */}
        <section>
          <MarkdownContent 
            content={report.interviewTrends.text} 
            sources={report.interviewTrends.sources} 
          />
        </section>
      </div>

    </div>
  );
};

export default DetailView;
