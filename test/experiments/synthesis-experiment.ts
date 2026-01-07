/**
 * Synthesis 모듈 프롬프트 실험
 *
 * 목표: 전략 생성 + 예상 질문 생성 프롬프트 개선
 *
 * 현재 문제점:
 * 1. Context가 substring으로 잘림
 * 2. 교수 정보가 context에 미포함
 * 3. 질문이 일반적, 꼬리질문 불명확
 * 4. 프롬프트가 영어
 *
 * 실행: npx tsx test/experiments/synthesis-experiment.ts
 */

import { GoogleGenAI, Type, Schema } from "@google/genai";
import * as fs from 'fs';
import * as path from 'path';

// 환경변수에서 API 키 로드
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_HIGH = 'gemini-3-pro-preview';
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

// ===== 샘플 입력 데이터 (하드코딩) =====

const sampleData = {
  uni: "충남대학교",
  dept: "정치외교학과",
  curriculum: `
1-2학년 핵심 과목:
- 정치학원론: 정치현상 기초 개념 (권력, 정당성, 국가론)
- 세계정치론: 국제관계 이론 (현실주의, 자유주의, 구성주의)
- 비교정치론: 국가별 정치체제 비교 (민주주의, 권위주의)
- 정치학방법론: 연구방법 (질적/양적 연구 설계)
- 계량정치분석: R 프로그래밍 활용 정치 데이터 분석

교육 트렌드:
- 데이터 분석 및 계량적 방법론 강조
- AI와 디지털 외교
- 첨단기술 외교 및 데이터 지정학
- 기후변화와 환경안보
`,
  professors: [
    { name: "박영득", researchTendency: "정치 양극화, 선거, 젠더, 미디어 연구. 선거제도와 투표행태, 정치 양극화 현상 분석" },
    { name: "김지운", researchTendency: "미중관계, 동북아 안보, 환경안보. 한반도 평화체제와 동아시아 국제정치 전문" },
    { name: "오영달", researchTendency: "국제정치, 과학기술외교, AI 안보. 신흥기술이 국제관계에 미치는 영향 연구" }
  ],
  trends: `
## 충남대 정치외교학과 편입 면접 특성
- 면접 비중: 40% (서류 60%)
- 꼬리질문 많음: 첫 답변 후 2-3회 추가 질문
- 시사 문제 빈출: 최근 1년 내 국제/국내 이슈

## 합격 요인 분석 (커뮤니티/후기 종합)
- 명확한 지원 동기: "왜 정치외교학과인가" 구체적 설명
- 전공 기초 지식: 1-2학년 핵심 개념 숙지
- 시사 이해도: 현재 진행 중인 국제 이슈 파악
- 논리적 답변 구조: 주장-근거-예시 형식

## 불합격 요인
- 피상적 답변: "관심 있어서", "취업 잘 되어서"
- 시사 무지: 최근 국제 이슈 모름
- 태도 불량: 눈 마주침 피함, 자신감 부족
- 꼬리질문 당황: 깊이 있는 후속 질문에 막힘
`
};

// ===== 개선된 프롬프트 (한국어) =====

/**
 * 구조화된 Context 생성 (개선)
 * - substring 대신 스마트 압축 사용
 * - 교수 정보 포함
 */
const buildStructuredContext = () => {
  const profSummary = sampleData.professors
    .map(p => `- ${p.name} 교수: ${p.researchTendency}`)
    .join('\n');

  return `
=== 학과 커리큘럼 ===
${sampleData.curriculum.trim()}

=== 면접 트렌드 및 합격/불합격 분석 ===
${sampleData.trends.trim()}

=== 교수진 연구 분야 ===
${profSummary}
`.trim();
};

// 개선된 전략 프롬프트 (한국어)
const buildImprovedStrategyPrompt = () => {
  const structuredContext = buildStructuredContext();

  return `
[역할]
당신은 ${sampleData.uni} ${sampleData.dept} 편입 면접 전략 코치입니다.
실제 합격생들의 패턴을 분석하여 최적의 면접 준비 전략을 수립합니다.

[시간 컨텍스트]
현재: ${currentYear}년 ${currentMonth}월
대상: ${currentYear}년 또는 ${currentYear + 1}학번 편입생

[입력 데이터]
${structuredContext}

[작업: 면접 전략 수립]

## 1. 핵심 전략 (coreStrategy)
3-5문장으로 종합 전략을 서술하세요:
- 커리큘럼 기반 준비 방향 (어떤 과목을 중점 학습해야 하는가)
- 면접 특성 반영 (40% 비중, 꼬리질문 대비)
- 교수진 연구 분야와 연결 가능한 준비 포인트
- 합격 요인을 강화하고 불합격 요인을 피하는 구체적 방법

## 2. 핵심 개념 5개 (coreConcepts)
면접에서 반드시 알아야 할 개념을 추출하세요.

각 개념 형식:
- keyword: 짧은 구문 (2-5단어). 절대 교수명 포함 금지!
  예시: "정치 양극화", "현실주의 vs 자유주의", "권력의 정당성"
- description: 왜 이 개념이 면접에서 중요한지 설명 (2-3문장)
- example: 실제 사례 또는 적용 예시

선정 기준:
1. 커리큘럼 핵심 과목에서 추출
2. 교수 연구 분야와 연관성 고려
3. 최근 시사 이슈와 연결 가능

[출력 형식]
JSON 형식으로만 응답:
{
  "coreStrategy": "전략 내용...",
  "coreConcepts": [
    {
      "keyword": "개념명",
      "description": "설명...",
      "example": "사례..."
    }
  ]
}
`.trim();
};

// 개선된 질문 프롬프트 (한국어)
const buildImprovedQuestionsPrompt = () => {
  const structuredContext = buildStructuredContext();

  return `
[역할]
당신은 ${sampleData.uni} ${sampleData.dept} 편입 면접 출제위원입니다.
교수의 관점에서 지원자의 전공 적합성을 평가하는 질문을 생성합니다.

[시간 컨텍스트]
현재: ${currentYear}년 ${currentMonth}월

[입력 데이터]
${structuredContext}

[질문 생성 규칙]

### HIGH 난이도 (3개 + 각각 꼬리질문 1개)
출제 범위:
- 커리큘럼 핵심 과목(정치학원론, 세계정치론, 비교정치론)에서 직접 출제
- 이론 적용, 사례 분석, 비판적 사고 요구
- 교수 연구 분야와 연관된 심화 질문 포함

꼬리질문 규칙:
- 첫 답변을 심화하거나 반대 관점에서 재질문
- "그렇다면...", "반대로...", "구체적으로..." 형식

예시:
Q: 현실주의와 자유주의 국제정치 이론의 핵심 차이를 설명하고, 현재 미중관계에 적용해 분석해보세요.
→ 꼬리질문: 그렇다면 구성주의 관점에서는 미중관계를 어떻게 다르게 해석할 수 있을까요?

### MEDIUM 난이도 (3개)
출제 범위:
- 전공 기초 개념의 정의, 비교, 설명
- 1-2학년 수업에서 다루는 핵심 내용
- 교과서 수준의 이론 이해도 확인

예시: "민주주의와 권위주의 체제의 핵심 차이점 3가지를 설명해보세요."

### LOW 난이도 (3개)
출제 범위:
- 지원 동기 (왜 정치외교학과인가, 왜 충남대인가)
- 기초 상식 (정치란 무엇인가, 외교의 역할)
- 학업 계획 및 진로

예시: "정치외교학을 공부하고 싶은 이유와 졸업 후 진로 계획을 말씀해주세요."

[출력 형식]
각 질문 형식:
{
  "question": "질문 내용",
  "intent": "출제 의도 (어떤 역량을 평가하는가)",
  "tip": "답변 팁 (어떻게 답해야 좋은 점수를 받는가)",
  "followUp": "꼬리질문 (HIGH만 해당, 나머지는 null)"
}

JSON으로 출력:
{
  "high": [...],
  "medium": [...],
  "low": [...]
}
`.trim();
};

// ===== 기존 프롬프트 (비교용) =====

const buildOldStrategyPrompt = () => {
  // 기존 방식: substring으로 자르고 영어 프롬프트
  const context = `
[커리큘럼 분석]
${sampleData.curriculum.substring(0, 500)}

[면접 트렌드]
${sampleData.trends.substring(0, 300)}
`.trim();

  return `
    Act as a Top-Tier Transfer Interview Strategic Agent for ${sampleData.uni} ${sampleData.dept}.
    Output MUST be in Korean.

    Input Data (Summarized):
    ${context}

    Tasks:
    1. Define "Core Strategy" (종합 면접 준비 전략).
       - Focus primarily on Curriculum and Successful Interview Cases.
       - Professor research should only be used as supplementary context.

    2. List 5 "Core Concepts" (핵심 아이디어/키워드).
       - The 'keyword' MUST be a short, single phrase.
       - NEVER include the professor's name in the 'keyword' field.
       - 'description': Explain the concept.
       - 'example': Provide a concrete real-world application.
  `;
};

const buildOldQuestionsPrompt = () => {
  const context = `
[커리큘럼 분석]
${sampleData.curriculum.substring(0, 500)}
`.trim();

  return `
    Act as a Top-Tier Transfer Interview Question Generator for ${sampleData.uni} ${sampleData.dept}.
    Output MUST be in Korean.

    Input Data (Summarized):
    ${context}

    Tasks:
    3. Generate 9 + 3(high 꼬리질문) Anticipated Questions based on the data.
       - 'high': High difficulty questions - deeply related to major. 각각 1개의 꼬리 질문 추가.
       - 'medium': Medium difficulty questions - related to major.
       - 'low': Low difficulty questions - basic knowledge.
  `;
};

// ===== 스키마 정의 =====

const strategySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    coreStrategy: { type: Type.STRING, description: "종합 면접 전략 (3-5문장)" },
    coreConcepts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          keyword: { type: Type.STRING, description: "핵심 개념 (2-5단어, 교수명 금지)" },
          description: { type: Type.STRING, description: "개념 설명 및 중요성" },
          example: { type: Type.STRING, description: "실제 사례 또는 적용 예시" },
        },
        required: ["keyword", "description", "example"]
      },
    },
  },
  required: ["coreStrategy", "coreConcepts"],
};

const questionsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    high: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "질문 내용" },
          intent: { type: Type.STRING, description: "출제 의도" },
          tip: { type: Type.STRING, description: "답변 팁" },
          followUp: { type: Type.STRING, description: "꼬리질문" },
        },
        required: ["question", "intent", "tip", "followUp"]
      },
    },
    medium: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "질문 내용" },
          intent: { type: Type.STRING, description: "출제 의도" },
          tip: { type: Type.STRING, description: "답변 팁" },
        },
        required: ["question", "intent", "tip"]
      },
    },
    low: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING, description: "질문 내용" },
          intent: { type: Type.STRING, description: "출제 의도" },
          tip: { type: Type.STRING, description: "답변 팁" },
        },
        required: ["question", "intent", "tip"]
      },
    },
  },
  required: ["high", "medium", "low"],
};

// ===== 실험 실행 =====

const runExperiment = async () => {
  console.log('='.repeat(60));
  console.log('Synthesis 모듈 프롬프트 실험');
  console.log(`대상: ${sampleData.uni} ${sampleData.dept}`);
  console.log(`모델: ${MODEL_HIGH}`);
  console.log('='.repeat(60));

  const results: any = {
    experimentName: 'synthesis_prompt_improvement',
    timestamp: new Date().toISOString(),
    sampleData: sampleData,
    old: { strategy: null, questions: null },
    new: { strategy: null, questions: null },
    comparison: {}
  };

  // API 키 확인
  if (!apiKey) {
    console.log('\n[경고] API_KEY가 설정되지 않았습니다.');
    console.log('프롬프트만 비교합니다.\n');

    console.log('=== 기존 전략 프롬프트 ===');
    console.log(buildOldStrategyPrompt());
    console.log('\n=== 개선 전략 프롬프트 ===');
    console.log(buildImprovedStrategyPrompt());
    console.log('\n=== 기존 질문 프롬프트 ===');
    console.log(buildOldQuestionsPrompt());
    console.log('\n=== 개선 질문 프롬프트 ===');
    console.log(buildImprovedQuestionsPrompt());

    results.old.strategyPrompt = buildOldStrategyPrompt();
    results.new.strategyPrompt = buildImprovedStrategyPrompt();
    results.old.questionsPrompt = buildOldQuestionsPrompt();
    results.new.questionsPrompt = buildImprovedQuestionsPrompt();

    saveResults(results);
    return results;
  }

  try {
    // 1. 기존 프롬프트 실행
    console.log('\n[1/4] 기존 전략 프롬프트 실행...');
    const oldStrategyResp = await ai.models.generateContent({
      model: MODEL_HIGH,
      contents: buildOldStrategyPrompt(),
      config: {
        responseMimeType: "application/json",
        responseSchema: strategySchema
      }
    });
    results.old.strategy = JSON.parse(oldStrategyResp.text || '{}');
    console.log('완료');

    await delay(2000);

    console.log('[2/4] 기존 질문 프롬프트 실행...');
    const oldQuestionsResp = await ai.models.generateContent({
      model: MODEL_HIGH,
      contents: buildOldQuestionsPrompt(),
      config: {
        responseMimeType: "application/json",
        responseSchema: questionsSchema
      }
    });
    results.old.questions = JSON.parse(oldQuestionsResp.text || '{}');
    console.log('완료');

    await delay(2000);

    // 2. 개선 프롬프트 실행
    console.log('[3/4] 개선 전략 프롬프트 실행...');
    const newStrategyResp = await ai.models.generateContent({
      model: MODEL_HIGH,
      contents: buildImprovedStrategyPrompt(),
      config: {
        responseMimeType: "application/json",
        responseSchema: strategySchema
      }
    });
    results.new.strategy = JSON.parse(newStrategyResp.text || '{}');
    console.log('완료');

    await delay(2000);

    console.log('[4/4] 개선 질문 프롬프트 실행...');
    const newQuestionsResp = await ai.models.generateContent({
      model: MODEL_HIGH,
      contents: buildImprovedQuestionsPrompt(),
      config: {
        responseMimeType: "application/json",
        responseSchema: questionsSchema
      }
    });
    results.new.questions = JSON.parse(newQuestionsResp.text || '{}');
    console.log('완료');

    // 3. 비교 분석
    results.comparison = compareResults(results);

  } catch (e: any) {
    console.error('실험 실패:', e.message);
    results.error = e.message;
  }

  saveResults(results);
  printSummary(results);

  return results;
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const compareResults = (results: any) => {
  const comparison: any = {
    strategy: {
      old: {
        length: results.old.strategy?.coreStrategy?.length || 0,
        conceptCount: results.old.strategy?.coreConcepts?.length || 0,
      },
      new: {
        length: results.new.strategy?.coreStrategy?.length || 0,
        conceptCount: results.new.strategy?.coreConcepts?.length || 0,
      }
    },
    questions: {
      old: {
        highCount: results.old.questions?.high?.length || 0,
        mediumCount: results.old.questions?.medium?.length || 0,
        lowCount: results.old.questions?.low?.length || 0,
        hasFollowUp: results.old.questions?.high?.some((q: any) => q.followUp) || false,
      },
      new: {
        highCount: results.new.questions?.high?.length || 0,
        mediumCount: results.new.questions?.medium?.length || 0,
        lowCount: results.new.questions?.low?.length || 0,
        hasFollowUp: results.new.questions?.high?.some((q: any) => q.followUp) || false,
      }
    }
  };

  // 개선점 평가
  comparison.improvements = [];

  if (comparison.strategy.new.length > comparison.strategy.old.length) {
    comparison.improvements.push('전략 설명이 더 상세해짐');
  }
  if (comparison.questions.new.hasFollowUp && !comparison.questions.old.hasFollowUp) {
    comparison.improvements.push('꼬리질문이 포함됨');
  }

  return comparison;
};

const saveResults = (results: any) => {
  const resultsDir = path.join(__dirname, '..', 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const filename = path.join(resultsDir, 'synthesis_result.json');
  fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n결과 저장: ${filename}`);
};

const printSummary = (results: any) => {
  console.log('\n' + '='.repeat(60));
  console.log('실험 결과 요약');
  console.log('='.repeat(60));

  if (results.old.strategy && results.new.strategy) {
    console.log('\n[전략 비교]');
    console.log(`기존 전략 길이: ${results.old.strategy.coreStrategy?.length || 0}자`);
    console.log(`개선 전략 길이: ${results.new.strategy.coreStrategy?.length || 0}자`);
    console.log(`기존 개념 수: ${results.old.strategy.coreConcepts?.length || 0}개`);
    console.log(`개선 개념 수: ${results.new.strategy.coreConcepts?.length || 0}개`);

    console.log('\n[개선 전략 - coreStrategy]');
    console.log(results.new.strategy.coreStrategy);

    console.log('\n[개선 전략 - coreConcepts]');
    results.new.strategy.coreConcepts?.forEach((c: any, i: number) => {
      console.log(`${i + 1}. ${c.keyword}`);
      console.log(`   설명: ${c.description}`);
      console.log(`   예시: ${c.example}`);
    });
  }

  if (results.old.questions && results.new.questions) {
    console.log('\n[질문 비교]');
    console.log(`기존 HIGH 질문: ${results.old.questions.high?.length || 0}개`);
    console.log(`개선 HIGH 질문: ${results.new.questions.high?.length || 0}개`);

    console.log('\n[개선 HIGH 질문 (꼬리질문 포함)]');
    results.new.questions.high?.forEach((q: any, i: number) => {
      console.log(`\nQ${i + 1}: ${q.question}`);
      console.log(`   의도: ${q.intent}`);
      console.log(`   팁: ${q.tip}`);
      console.log(`   꼬리: ${q.followUp}`);
    });

    console.log('\n[개선 MEDIUM 질문]');
    results.new.questions.medium?.forEach((q: any, i: number) => {
      console.log(`Q${i + 1}: ${q.question}`);
    });

    console.log('\n[개선 LOW 질문]');
    results.new.questions.low?.forEach((q: any, i: number) => {
      console.log(`Q${i + 1}: ${q.question}`);
    });
  }

  if (results.comparison?.improvements?.length) {
    console.log('\n[개선 사항]');
    results.comparison.improvements.forEach((imp: string) => {
      console.log(`- ${imp}`);
    });
  }

  console.log('\n' + '='.repeat(60));
};

// 실행
runExperiment().catch(console.error);
