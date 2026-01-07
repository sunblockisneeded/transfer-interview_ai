/**
 * Curriculum 프롬프트 근본적 재설계 실험
 *
 * 가설: 짧고 목적이 명확한 프롬프트가 더 유용한 응답을 생성한다
 *
 * 실행: API_KEY=xxx npx tsx test/experiments/curriculum-v2-experiment.ts
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";
const currentYear = new Date().getFullYear();

// ========== 프롬프트 버전들 ==========

// V1: 현재 버전 (방어적, 구조 강제)
const promptV1 = `
[역할]
당신은 한국 대학 교육과정 분석 전문가입니다.

[시간 컨텍스트]
당신의 학습 데이터는 2024년까지입니다. 이후의 정보는 도구나 시스템 메시지로 제공되지 않는 한 알 수 없습니다.
현재 시점: ${currentYear}년
대상 학년도: ${currentYear}년 또는 ${currentYear + 1}학번

[분석 대상]
- 대학: ${UNI}
- 학과: ${DEPT}

[작업]
다음 세 가지 항목을 분석하세요:

# 1. 1-2학년 핵심 전공기초 과목
- 해당 학과의 전공기초/전공필수 과목 목록을 검색하세요
- 각 과목에 대해 다음 정보 제공:
  - 과목명
  - 간단한 설명 (1-2줄)
  - 편입생에게 왜 중요한지

# 2. 편입생이 반드시 알아야 할 선수지식
- 해당 학과 편입생이 면접에서 기본으로 알아야 할 개념/이론
- 교수가 기대하는 기초 역량
- 1학년 과정에서 다루는 핵심 내용 요약

# 3. 최근 교육 트렌드
- 해당 분야의 국내외 최신 교육 동향
- 새롭게 강조되는 역량 (데이터분석, AI, 디지털 역량 등)
- 학과 커리큘럼에 반영된 변화

[출력 규칙]
- 마크다운 형식으로만 작성 (HTML 태그 절대 금지)
- 검색 결과로 확인된 정보만 포함
- 추측하지 말 것
- 확인할 수 없는 정보는 "확인 필요" 또는 "정보 없음"으로 표시
- 출처가 불분명한 구체적 수치/날짜는 생략

[금지 사항]
- HTML 태그 (<h1>, <strong>, <br> 등) 사용 금지
- 확인되지 않은 교수명, 과목 코드 언급 금지
- "~것으로 보인다", "~일 것이다" 등 추측성 표현 금지
`;

// V2: 간결 버전 (목적만 전달)
const promptV2 = `
${UNI} ${DEPT} 편입 면접을 준비하는 학생입니다.

면접에서 교수님이 "전공 기초"로 기대하는 지식이 뭔지 알고 싶어요.
1-2학년 핵심 과목과 그 과목에서 다루는 핵심 개념을 알려주세요.

실제 면접에서 물어볼 만한 개념 위주로 정리해주세요.
`;

// V3: 튜터 역할 버전 (대화형)
const promptV3 = `
당신은 ${UNI} ${DEPT} 편입에 성공한 선배입니다.

후배가 물어봅니다: "선배, 면접 준비하려는데 전공 기초로 뭘 알아야 해요?"

1-2학년 때 배우는 핵심 과목들과, 각 과목에서 면접에 나올 만한 개념들을
실제 경험담처럼 자연스럽게 알려주세요.

"이 과목에서는 이런 개념이 중요한데, 면접에서 이렇게 물어볼 수 있어"
이런 식으로요.
`;

// ========== 실험 실행 ==========

interface ExperimentResult {
  version: string;
  promptLength: number;
  response: string;
  responseLength: number;
  duration: number;
  analysis: {
    hasConcreteExamples: boolean;
    hasPracticalAdvice: boolean;
    naturalTone: boolean;
    specificConcepts: string[];
    usefulnessScore: number; // 1-5
  };
}

const analyzeResponse = (text: string): ExperimentResult['analysis'] => {
  // 구체적 개념 추출 (정치학 관련)
  const conceptPatterns = [
    /민주주의/g, /권력/g, /국가/g, /주권/g,
    /현실주의/g, /자유주의/g, /구성주의/g,
    /세력균형/g, /국제정치/g, /비교정치/g,
    /정치사상/g, /정당/g, /선거/g, /의회/g,
    /외교/g, /안보/g, /국제기구/g
  ];

  const foundConcepts = new Set<string>();
  conceptPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => foundConcepts.add(m));
    }
  });

  // 실용적 조언 여부 (행동 가능한 표현)
  const practicalPatterns = [
    /준비하세요/g, /공부하세요/g, /읽어보세요/g,
    /정리하세요/g, /연습하세요/g, /숙지하세요/g,
    /~하면 좋/g, /추천/g, /팁/g
  ];
  const hasPracticalAdvice = practicalPatterns.some(p => p.test(text));

  // 자연스러운 톤 (딱딱한 구조 vs 대화체)
  const formalPatterns = [
    /\[역할\]/g, /\[작업\]/g, /\[출력 규칙\]/g,
    /다음과 같습니다/g, /분석 결과/g
  ];
  const informalPatterns = [
    /~거든요/g, /~해요/g, /~죠/g, /선배/g, /후배/g,
    /사실/g, /솔직히/g, /개인적으로/g
  ];

  const formalCount = formalPatterns.reduce((sum, p) => sum + (text.match(p)?.length || 0), 0);
  const informalCount = informalPatterns.reduce((sum, p) => sum + (text.match(p)?.length || 0), 0);
  const naturalTone = informalCount > formalCount;

  // 구체적 예시 여부
  const hasConcreteExamples = /예를 들어|예시|실제로|~의 경우/.test(text);

  // 유용성 점수 (휴리스틱)
  let usefulnessScore = 1;
  if (foundConcepts.size >= 5) usefulnessScore++;
  if (foundConcepts.size >= 10) usefulnessScore++;
  if (hasPracticalAdvice) usefulnessScore++;
  if (hasConcreteExamples) usefulnessScore++;

  return {
    hasConcreteExamples,
    hasPracticalAdvice,
    naturalTone,
    specificConcepts: Array.from(foundConcepts),
    usefulnessScore
  };
};

const runExperiment = async (version: string, prompt: string): Promise<ExperimentResult> => {
  console.log(`\n[${'='.repeat(50)}]`);
  console.log(`실험: ${version}`);
  console.log(`프롬프트 길이: ${prompt.length}자`);
  console.log(`[${'='.repeat(50)}]`);

  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || '';
    const duration = Date.now() - start;
    const analysis = analyzeResponse(text);

    console.log(`\n응답 길이: ${text.length}자`);
    console.log(`소요 시간: ${(duration/1000).toFixed(1)}초`);
    console.log(`발견된 개념: ${analysis.specificConcepts.join(', ')}`);
    console.log(`유용성 점수: ${analysis.usefulnessScore}/5`);
    console.log(`\n--- 응답 미리보기 (500자) ---`);
    console.log(text.substring(0, 500) + '...');

    return {
      version,
      promptLength: prompt.length,
      response: text,
      responseLength: text.length,
      duration,
      analysis
    };
  } catch (e: any) {
    console.error(`실험 실패: ${e.message}`);
    return {
      version,
      promptLength: prompt.length,
      response: `ERROR: ${e.message}`,
      responseLength: 0,
      duration: Date.now() - start,
      analysis: {
        hasConcreteExamples: false,
        hasPracticalAdvice: false,
        naturalTone: false,
        specificConcepts: [],
        usefulnessScore: 0
      }
    };
  }
};

const main = async () => {
  console.log('='.repeat(60));
  console.log('Curriculum 프롬프트 근본적 재설계 실험');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log(`모델: ${MODEL}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results: ExperimentResult[] = [];

  // V1 실험
  results.push(await runExperiment('V1_현재버전_방어적', promptV1));
  await new Promise(r => setTimeout(r, 3000));

  // V2 실험
  results.push(await runExperiment('V2_간결버전_목적중심', promptV2));
  await new Promise(r => setTimeout(r, 3000));

  // V3 실험
  results.push(await runExperiment('V3_튜터버전_대화형', promptV3));

  // 결과 비교
  console.log('\n' + '='.repeat(60));
  console.log('실험 결과 비교');
  console.log('='.repeat(60));

  console.log('\n| 버전 | 프롬프트 | 응답 | 시간 | 개념수 | 유용성 |');
  console.log('|------|---------|------|------|--------|--------|');

  results.forEach(r => {
    console.log(`| ${r.version.substring(0, 15)} | ${r.promptLength}자 | ${r.responseLength}자 | ${(r.duration/1000).toFixed(1)}s | ${r.analysis.specificConcepts.length}개 | ${r.analysis.usefulnessScore}/5 |`);
  });

  console.log('\n상세 분석:');
  results.forEach(r => {
    console.log(`\n[${r.version}]`);
    console.log(`- 구체적 예시: ${r.analysis.hasConcreteExamples ? 'O' : 'X'}`);
    console.log(`- 실용적 조언: ${r.analysis.hasPracticalAdvice ? 'O' : 'X'}`);
    console.log(`- 자연스러운 톤: ${r.analysis.naturalTone ? 'O' : 'X'}`);
    console.log(`- 발견된 개념: ${r.analysis.specificConcepts.slice(0, 10).join(', ')}`);
  });

  // 승자 판정
  const winner = results.reduce((best, curr) =>
    curr.analysis.usefulnessScore > best.analysis.usefulnessScore ? curr : best
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log(`최적 버전: ${winner.version}`);
  console.log(`이유: 유용성 점수 ${winner.analysis.usefulnessScore}/5`);
  console.log(`${'='.repeat(60)}`);

  // 결과 저장
  const outputDir = './test/results';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = `${outputDir}/curriculum_v2_experiment_${Date.now()}.json`;
  fs.writeFileSync(outputPath, JSON.stringify({
    experiment: 'curriculum_fundamental_redesign',
    timestamp: new Date().toISOString(),
    target: { uni: UNI, dept: DEPT },
    model: MODEL,
    results: results.map(r => ({
      ...r,
      response: r.response.substring(0, 2000) + (r.response.length > 2000 ? '...(truncated)' : '')
    })),
    winner: winner.version
  }, null, 2), 'utf-8');

  console.log(`\n결과 저장: ${outputPath}`);
};

main().catch(console.error);
