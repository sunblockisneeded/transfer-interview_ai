/**
 * 충남대학교 정치외교학과 리포트 생성
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { ai, MODEL_RESEARCH } from '../../api/_config.js';
import { generateContentWithSmartRetry, cleanOutput, parseJsonSafe } from '../../api/_utils.js';
import { validateFullReport } from '../validators/reportValidator.js';
import { FullReport } from '../../types.js';
import { Type, Schema } from '@google/genai';
import * as fs from 'fs';

const UNI = '충남대학교';
const DEPT = '정치외교학과';

async function fetchCurriculum() {
  console.log(`\n📚 [${UNI}] 커리큘럼 분석 중...`);
  const prompt = `
"${UNI} ${DEPT} 교육과정" 또는 "${UNI} 사회과학대학 ${DEPT}"를 검색하여 편입 면접 준비 가이드를 작성해주세요.

[필수]
- 실제 과목명 확인 후 작성 (추측 금지)
- 학과 홈페이지나 공식 자료 기반

[출력 형식]
## 핵심 전공 과목
| 과목명 | 핵심 개념 | 면접 예상 질문 |

## 학과 특색
## 면접 준비 핵심
`;
  const response = await generateContentWithSmartRetry(
    ai.models, MODEL_RESEARCH, prompt,
    { tools: [{ googleSearch: {} }] },
    90000, `${UNI}-Curriculum`
  );
  return { text: cleanOutput(response.text || ''), sources: extractSources(response) };
}

async function fetchProfessors() {
  console.log(`\n👨‍🏫 [${UNI}] 교수진 분석 중...`);
  const professorSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      professors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: '교수 실명 (2-4글자 한글)' },
            field: { type: Type.STRING, description: '전공/연구 분야' },
            interviewTip: { type: Type.STRING, description: '면접 연결 포인트' },
          },
          required: ['name', 'field', 'interviewTip'],
        },
      },
      analysisText: { type: Type.STRING, description: '학과 강점 분석 (500자 이상)' },
    },
    required: ['professors', 'analysisText'],
  };

  const prompt = `
"${UNI} ${DEPT} 교수진" 또는 "${UNI} 사회과학대학 ${DEPT} 교수"를 검색하여 실제 교수 명단을 확인하세요.

[필수]
- 실제 재직 교수만 포함 (명예교수, 퇴직교수 제외)
- 최소 3명 이상
- 각 교수: 이름(한글 2-4자), 전공분야, 면접 팁

analysisText에는 학과 강점과 면접 어필 포인트를 500자 이상으로 작성
`;
  const response = await generateContentWithSmartRetry(
    ai.models, MODEL_RESEARCH, prompt,
    { tools: [{ googleSearch: {} }], responseMimeType: 'application/json', responseSchema: professorSchema },
    90000, `${UNI}-Professors`
  );

  const data = parseJsonSafe(response.text || '{}');
  const validProfessors = (data.professors || [])
    .filter((p: any) => p.name && /^[가-힣]{2,4}$/.test(p.name))
    .map((p: any) => ({
      name: p.name,
      lab: p.field,
      majorPapers: [],
      researchTendency: p.field,
      interviewQuestion: p.interviewTip,
    }));

  return {
    professors: validProfessors,
    majorKnowledgeAnalysis: cleanOutput(data.analysisText || ''),
    sources: extractSources(response),
  };
}

async function fetchTrends() {
  console.log(`\n📈 [${UNI}] 면접 트렌드 분석 중...`);
  const prompt = `
"${UNI} ${DEPT} 편입 면접 후기" 또는 "${UNI} 편입 합격 수기"를 검색하여 면접 준비 가이드를 작성해주세요.

[출력 형식]
## 실제 면접 질문
## 합격자 공통점
## 준비 체크리스트
`;
  const response = await generateContentWithSmartRetry(
    ai.models, MODEL_RESEARCH, prompt,
    { tools: [{ googleSearch: {} }] },
    90000, `${UNI}-Trends`
  );
  return { text: cleanOutput(response.text || ''), sources: extractSources(response) };
}

async function fetchStrategy(currText: string, trendsText: string) {
  console.log(`\n🎯 [${UNI}] 전략 및 질문 생성 중...`);
  const strategySchema: Schema = {
    type: Type.OBJECT,
    properties: {
      coreStrategy: { type: Type.STRING, description: '종합 면접 전략 (300자 이상)' },
      coreConcepts: {
        type: Type.ARRAY,
        description: '핵심 개념 5개 (1-2학년 교과서 수준)',
        items: {
          type: Type.OBJECT,
          properties: {
            keyword: { type: Type.STRING, description: '개념명 (5단어 이하)' },
            description: { type: Type.STRING, description: '설명 (100자 이상)' },
            example: { type: Type.STRING, description: '실제 사례 (50자 이상)' },
          },
          required: ['keyword', 'description', 'example'],
        },
      },
      questions: {
        type: Type.OBJECT,
        properties: {
          high: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, intent: { type: Type.STRING }, tip: { type: Type.STRING } }, required: ['question', 'intent', 'tip'] } },
          medium: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, intent: { type: Type.STRING }, tip: { type: Type.STRING } }, required: ['question', 'intent', 'tip'] } },
          low: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, intent: { type: Type.STRING }, tip: { type: Type.STRING } }, required: ['question', 'intent', 'tip'] } },
        },
        required: ['high', 'medium', 'low'],
      },
    },
    required: ['coreStrategy', 'coreConcepts', 'questions'],
  };

  const prompt = `
${UNI} ${DEPT} 편입 면접 전략을 생성하세요.

[1-2학년 핵심 전공 과목 분석]
${currText.substring(0, 2000)}

[실제 면접 기출 및 빈출 경향]
${trendsText.substring(0, 1500)}

[중요 지침]
- 질문은 반드시 "1-2학년 교과서 수준"에서 출제
- 정치외교학과 공통 핵심 과목 기반 (정치학개론, 국제정치학, 비교정치, 한국정치 등)
- 편입 면접의 목적: "3학년 수업을 따라갈 기초 역량 확인"

[출력 요구사항]
1. coreStrategy: 종합 면접 전략 (300자 이상)
2. coreConcepts: 정확히 5개의 핵심 개념
   - 정치외교학 기본 개념: "민주주의", "권력", "현실주의", "자유주의", "주권" 등
3. questions: 난이도별 각 3개
`;
  const response = await generateContentWithSmartRetry(
    ai.models, MODEL_RESEARCH, prompt,
    { responseMimeType: 'application/json', responseSchema: strategySchema },
    90000, `${UNI}-Strategy`
  );

  const data = parseJsonSafe(response.text || '{}');
  return {
    coreStrategy: data.coreStrategy || '',
    coreConcepts: (data.coreConcepts || []).slice(0, 5),
    questions: {
      high: (data.questions?.high || []).slice(0, 3),
      medium: (data.questions?.medium || []).slice(0, 3),
      low: (data.questions?.low || []).slice(0, 3),
    },
  };
}

function extractSources(response: any) {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .filter((c: any) => c.web?.uri && c.web?.title)
    .map((c: any) => ({ title: c.web.title, uri: c.web.uri }))
    .slice(0, 5);
}

function generateHtmlReport(report: FullReport): string {
  const mdToHtml = (text: string): string => {
    return text
      .replace(/^(#{1,4})\s*\1\s*/gm, '$1 ')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h3 style="color:#6366f1;margin-top:25px;">$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- \[ \] (.+)$/gm, '<li style="list-style:none;">☐ $1</li>')
      .replace(/^- \[x\] (.+)$/gm, '<li style="list-style:none;">☑ $1</li>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">')
      .replace(/\n/g, '<br>');
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>${report.university} ${report.department} - 편입 면접 가이드</title>
  <style>
    body { font-family: 'Noto Serif KR', serif; max-width: 900px; margin: 0 auto; padding: 40px; line-height: 1.8; color: #1e293b; }
    h1 { border-bottom: 3px solid #6366f1; padding-bottom: 15px; }
    h2 { color: #6366f1; margin-top: 40px; border-left: 4px solid #6366f1; padding-left: 15px; }
    .section { background: #f8fafc; padding: 25px; border-radius: 12px; margin: 20px 0; }
    .professor-card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #6366f1; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .concept-card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border: 1px solid #e2e8f0; }
    .question-card { background: #fffbeb; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #f59e0b; }
    .question-card.high { border-left-color: #ef4444; background: #fef2f2; }
    .question-card.medium { border-left-color: #f59e0b; background: #fffbeb; }
    .question-card.low { border-left-color: #22c55e; background: #f0fdf4; }
    .source-list { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 10px; font-size: 0.9em; }
    .source-list a { color: #6366f1; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <h1>${report.university} ${report.department}</h1>
  <p>편입 면접 준비 종합 가이드 | 생성일: ${new Date().toLocaleDateString('ko-KR')}</p>

  <h2>1. 커리큘럼 분석</h2>
  <div class="section">${mdToHtml(report.curriculumAnalysis.text)}</div>
  ${report.curriculumAnalysis.sources?.length ? `<div class="source-list"><strong>출처:</strong> ${report.curriculumAnalysis.sources.map(s => `<a href="${s.uri}" target="_blank">${s.title}</a>`).join(' | ')}</div>` : ''}

  <h2>2. 교수진 현황</h2>
  <div class="section">
    ${report.professorAnalysis.professors.map(p => `
      <div class="professor-card">
        <strong>${p.name}</strong> - ${p.researchTendency || p.lab || ''}
        ${(p as any).interviewQuestion ? `<br><em>면접 팁: ${(p as any).interviewQuestion}</em>` : ''}
      </div>
    `).join('')}
  </div>
  ${report.professorAnalysis.sources?.length ? `<div class="source-list"><strong>출처:</strong> ${report.professorAnalysis.sources.map(s => `<a href="${s.uri}" target="_blank">${s.title}</a>`).join(' | ')}</div>` : ''}

  <h2>3. 학과 강점 분석</h2>
  <div class="section">${mdToHtml(report.professorAnalysis.majorKnowledgeAnalysis)}</div>

  <h2>4. 면접 트렌드</h2>
  <div class="section">${mdToHtml(report.interviewTrends.text)}</div>
  ${report.interviewTrends.sources?.length ? `<div class="source-list"><strong>출처:</strong> ${report.interviewTrends.sources.map(s => `<a href="${s.uri}" target="_blank">${s.title}</a>`).join(' | ')}</div>` : ''}

  <h2>5. 종합 전략</h2>
  <div class="section">${mdToHtml(report.strategy.coreStrategy)}</div>

  <h2>6. 핵심 개념 TOP 5</h2>
  <div class="section">
    ${report.strategy.coreConcepts.map((c, i) => `
      <div class="concept-card">
        <strong>${i + 1}. ${c.keyword}</strong>
        <p>${c.description}</p>
        <p><em>예시: ${c.example}</em></p>
      </div>
    `).join('')}
  </div>

  <h2>7. 예상 질문 - 고난이도</h2>
  ${report.strategy.questions.high.map(q => `
    <div class="question-card high">
      <strong>Q: ${q.question}</strong>
      <p><strong>의도:</strong> ${q.intent}</p>
      <p><strong>팁:</strong> ${q.tip}</p>
    </div>
  `).join('')}

  <h2>8. 예상 질문 - 중난이도</h2>
  ${report.strategy.questions.medium.map(q => `
    <div class="question-card medium">
      <strong>Q: ${q.question}</strong>
      <p><strong>의도:</strong> ${q.intent}</p>
      <p><strong>팁:</strong> ${q.tip}</p>
    </div>
  `).join('')}

  <h2>9. 예상 질문 - 기초/인성</h2>
  ${report.strategy.questions.low.map(q => `
    <div class="question-card low">
      <strong>Q: ${q.question}</strong>
      <p><strong>의도:</strong> ${q.intent}</p>
      <p><strong>팁:</strong> ${q.tip}</p>
    </div>
  `).join('')}

</body>
</html>`;
}

async function main() {
  console.log('═'.repeat(60));
  console.log(`🎯 ${UNI} ${DEPT} 보고서 생성`);
  console.log('═'.repeat(60));

  const startTime = Date.now();

  const [curriculum, professors, trends] = await Promise.all([
    fetchCurriculum(),
    fetchProfessors(),
    fetchTrends(),
  ]);

  const strategy = await fetchStrategy(curriculum.text, trends.text);

  const report: FullReport = {
    university: UNI,
    department: DEPT,
    curriculumAnalysis: curriculum,
    professorAnalysis: professors,
    interviewTrends: trends,
    strategy,
  };

  const validation = validateFullReport(report);

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 [${UNI}] 품질 검증`);
  console.log('═'.repeat(60));
  console.log(`✅ isValid: ${validation.isValid}`);
  console.log(`📈 Score: ${validation.score}/100`);

  if (validation.errors.length > 0) {
    console.log('\n❌ Errors:');
    validation.errors.forEach(e => console.log(`  - ${e}`));
  }

  // 팩트체크용 JSON 출력
  const factCheckData = {
    university: UNI,
    department: DEPT,
    professors: professors.professors.map(p => p.name),
    coreConcepts: strategy.coreConcepts.map(c => c.keyword),
    sources: {
      curriculum: curriculum.sources,
      professors: professors.sources,
      trends: trends.sources,
    }
  };

  console.log('\n📋 팩트체크 데이터:');
  console.log(JSON.stringify(factCheckData, null, 2));

  const html = generateHtmlReport(report);
  const filename = `${UNI}_${DEPT}_Report_${Date.now()}.html`;
  fs.writeFileSync(filename, html, 'utf-8');
  console.log(`\n📁 보고서 저장: ${filename}`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️  총 소요 시간: ${duration}초`);

  // 팩트체크 파일도 저장
  fs.writeFileSync(`${UNI}_factcheck.json`, JSON.stringify(factCheckData, null, 2), 'utf-8');
}

main().catch(console.error);
