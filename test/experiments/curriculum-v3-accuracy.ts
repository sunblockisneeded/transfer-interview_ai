/**
 * Curriculum 프롬프트 V3 실험 (유용성 + 정확성 + 톤)
 *
 * 평가 기준:
 * 1. 유용성: 편입생에게 실제로 도움이 되는가?
 * 2. 정확성: 할루시네이션이 있는가? 검증 가능한가?
 * 3. 톤: 리포트에 적합한 공식적 어조인가?
 *
 * 실행: API_KEY=xxx npx tsx test/experiments/curriculum-v3-accuracy.ts
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

// V1: 기존 방어적 (정확성 중시, 딱딱함)
const promptV1_Defensive = `
[역할]
당신은 한국 대학 교육과정 분석 전문가입니다.

[시간 컨텍스트]
당신의 학습 데이터는 2024년까지입니다.
현재 시점: ${currentYear}년

[분석 대상]
- 대학: ${UNI}
- 학과: ${DEPT}

[작업]
1-2학년 핵심 전공기초 과목을 분석하세요.

[출력 규칙]
- 검색 결과로 확인된 정보만 포함
- 추측하지 말 것
- 확인할 수 없는 정보는 "확인 필요"로 표시

[금지 사항]
- 확인되지 않은 교수명, 과목 코드 언급 금지
- "~것으로 보인다" 등 추측성 표현 금지
`;

// V2: 캐주얼 튜터형 (유용성 중시, 톤 부적절)
const promptV2_Casual = `
당신은 ${UNI} ${DEPT} 편입에 성공한 선배입니다.

후배가 물어봅니다: "선배, 면접 준비하려는데 전공 기초로 뭘 알아야 해요?"

1-2학년 때 배우는 핵심 과목들과, 각 과목에서 면접에 나올 만한 개념들을
실제 경험담처럼 자연스럽게 알려주세요.

"이 과목에서는 이런 개념이 중요한데, 면접에서 이렇게 물어볼 수 있어"
이런 식으로요.
`;

// V3: 공식적 + 실용적 (정확성 + 유용성 균형)
const promptV3_Balanced = `
${UNI} ${DEPT} 편입 면접 준비 가이드를 작성해주세요.

[대상 독자]
${currentYear}년 또는 ${currentYear + 1}학년도 편입을 준비하는 학생

[작성 내용]
1. **1-2학년 핵심 전공 과목**
   - 과목명과 주요 학습 내용
   - 편입 면접에서 자주 출제되는 개념

2. **면접 대비 핵심 개념**
   - 반드시 알아야 할 이론/개념
   - 예상 질문과 답변 방향

[작성 원칙]
- 공식적이고 신뢰할 수 있는 톤으로 작성
- 학과 홈페이지에서 확인한 정보 기반
- 확인되지 않은 정보는 "확인 필요" 표시
- 구체적이고 실용적인 조언 포함
`;

// V4: 검증 강화형 (정확성 최우선)
const promptV4_Verified = `
${UNI} ${DEPT} 교육과정을 분석하여 편입 면접 가이드를 작성합니다.

[검색 및 검증]
1. "${UNI} ${DEPT} 교육과정" 검색
2. "${UNI} ${DEPT} 전공필수" 검색
3. 학과 공식 홈페이지 정보 확인

[작성 규칙]
- 검색으로 확인된 과목명만 기재
- 각 정보의 출처를 명시 (예: "학과 홈페이지 기준")
- 불확실한 정보는 "※ 최신 교육과정 확인 필요" 표시
- 추측이나 일반화 금지

[출력 형식]
## ${DEPT} 전공 기초 과목 (${UNI})

### 1. 전공필수/기초 과목
| 과목명 | 주요 내용 | 면접 예상 질문 |
|--------|----------|---------------|

### 2. 핵심 개념 정리
(검색 결과 기반으로 확인된 개념만)

### 3. 참고사항
- 출처 및 확인 필요 사항
`;

// ========== 평가 함수들 ==========

interface AccuracyCheck {
  verifiableFacts: string[];      // 검증 가능한 사실들
  suspiciousContent: string[];    // 의심스러운 내용
  hedgingExpressions: number;     // 추측성 표현 수
  sourcesMentioned: boolean;      // 출처 언급 여부
  uncertaintyMarked: boolean;     // 불확실성 표시 여부
}

interface ToneCheck {
  formalLevel: 'formal' | 'semi-formal' | 'casual';
  casualExpressions: string[];
  appropriateForReport: boolean;
}

interface UsefulnessCheck {
  hasConcreteExamples: boolean;
  hasActionableAdvice: boolean;
  specificConcepts: string[];
  practicalValue: number; // 1-5
}

const checkAccuracy = (text: string): AccuracyCheck => {
  // 검증 가능한 사실 (과목명, 교수명 등)
  const coursePattern = /정치학개론|국제정치|비교정치|정치사상|외교정책|한국정치/g;
  const verifiableFacts = text.match(coursePattern) || [];

  // 의심스러운 내용 (구체적 수치, 연도 등)
  const suspiciousPatterns = [
    /\d{4}년.*개설/g,      // "2020년 개설" 같은 구체적 연도
    /\d+%/g,               // 구체적 퍼센트
    /\d+학점/g,            // 구체적 학점
  ];
  const suspiciousContent: string[] = [];
  suspiciousPatterns.forEach(p => {
    const matches = text.match(p);
    if (matches) suspiciousContent.push(...matches);
  });

  // 추측성 표현
  const hedgingPatterns = [
    /것으로 보인다/g, /것 같다/g, /추정된다/g,
    /아마/g, /probably/gi, /maybe/gi,
    /~듯/g, /~인 듯/g
  ];
  const hedgingExpressions = hedgingPatterns.reduce(
    (sum, p) => sum + (text.match(p)?.length || 0), 0
  );

  // 출처 언급
  const sourcesMentioned = /홈페이지|공식|출처|기준|참고/.test(text);

  // 불확실성 표시
  const uncertaintyMarked = /확인 필요|정보 없음|최신.*확인|검증 필요/.test(text);

  return {
    verifiableFacts: [...new Set(verifiableFacts)],
    suspiciousContent,
    hedgingExpressions,
    sourcesMentioned,
    uncertaintyMarked
  };
};

const checkTone = (text: string): ToneCheck => {
  const casualPatterns = [
    /~어요/g, /~해요/g, /~죠/g, /~거든요/g,
    /~야/g, /~줘/g, /~할게/g,
    /선배/g, /후배/g, /친구/g
  ];

  const casualExpressions: string[] = [];
  casualPatterns.forEach(p => {
    const matches = text.match(p);
    if (matches) casualExpressions.push(...matches.slice(0, 3));
  });

  const casualCount = casualExpressions.length;

  let formalLevel: 'formal' | 'semi-formal' | 'casual';
  if (casualCount === 0) formalLevel = 'formal';
  else if (casualCount <= 5) formalLevel = 'semi-formal';
  else formalLevel = 'casual';

  return {
    formalLevel,
    casualExpressions: [...new Set(casualExpressions)],
    appropriateForReport: formalLevel !== 'casual'
  };
};

const checkUsefulness = (text: string): UsefulnessCheck => {
  const hasConcreteExamples = /예를 들어|예시|실제로|예상 질문/.test(text);
  const hasActionableAdvice = /준비하|공부하|숙지하|정리하|확인하/.test(text);

  const conceptPatterns = [
    /민주주의/g, /권력/g, /국가/g, /주권/g,
    /현실주의/g, /자유주의/g, /구성주의/g,
    /세력균형/g, /국제정치/g, /비교정치/g
  ];

  const specificConcepts = new Set<string>();
  conceptPatterns.forEach(p => {
    const matches = text.match(p);
    if (matches) matches.forEach(m => specificConcepts.add(m));
  });

  let practicalValue = 1;
  if (hasConcreteExamples) practicalValue++;
  if (hasActionableAdvice) practicalValue++;
  if (specificConcepts.size >= 5) practicalValue++;
  if (specificConcepts.size >= 10) practicalValue++;

  return {
    hasConcreteExamples,
    hasActionableAdvice,
    specificConcepts: Array.from(specificConcepts),
    practicalValue
  };
};

// ========== 실험 실행 ==========

interface ExperimentResult {
  version: string;
  promptLength: number;
  response: string;
  responseLength: number;
  duration: number;
  accuracy: AccuracyCheck;
  tone: ToneCheck;
  usefulness: UsefulnessCheck;
  overallScore: number;
}

const runExperiment = async (version: string, prompt: string): Promise<ExperimentResult> => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`실험: ${version}`);
  console.log(`프롬프트 길이: ${prompt.length}자`);
  console.log(`${'='.repeat(60)}`);

  const start = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });

    const text = response.text || '';
    const duration = Date.now() - start;

    const accuracy = checkAccuracy(text);
    const tone = checkTone(text);
    const usefulness = checkUsefulness(text);

    // 종합 점수 계산 (정확성 40%, 유용성 40%, 톤 20%)
    let overallScore = 0;

    // 정확성 점수 (40점 만점)
    if (accuracy.uncertaintyMarked) overallScore += 10;
    if (accuracy.sourcesMentioned) overallScore += 10;
    if (accuracy.hedgingExpressions === 0) overallScore += 10;
    if (accuracy.suspiciousContent.length === 0) overallScore += 10;

    // 유용성 점수 (40점 만점)
    overallScore += usefulness.practicalValue * 8;

    // 톤 점수 (20점 만점)
    if (tone.appropriateForReport) overallScore += 20;

    console.log(`\n[정확성]`);
    console.log(`  - 검증 가능 사실: ${accuracy.verifiableFacts.join(', ')}`);
    console.log(`  - 의심스러운 내용: ${accuracy.suspiciousContent.length}개`);
    console.log(`  - 추측성 표현: ${accuracy.hedgingExpressions}개`);
    console.log(`  - 출처 언급: ${accuracy.sourcesMentioned ? 'O' : 'X'}`);
    console.log(`  - 불확실성 표시: ${accuracy.uncertaintyMarked ? 'O' : 'X'}`);

    console.log(`\n[톤]`);
    console.log(`  - 공식성: ${tone.formalLevel}`);
    console.log(`  - 캐주얼 표현: ${tone.casualExpressions.join(', ') || '없음'}`);
    console.log(`  - 리포트 적합: ${tone.appropriateForReport ? 'O' : 'X'}`);

    console.log(`\n[유용성]`);
    console.log(`  - 구체적 예시: ${usefulness.hasConcreteExamples ? 'O' : 'X'}`);
    console.log(`  - 실행 가능 조언: ${usefulness.hasActionableAdvice ? 'O' : 'X'}`);
    console.log(`  - 핵심 개념 수: ${usefulness.specificConcepts.length}개`);
    console.log(`  - 실용성 점수: ${usefulness.practicalValue}/5`);

    console.log(`\n[종합 점수]: ${overallScore}/100`);

    console.log(`\n--- 응답 미리보기 (400자) ---`);
    console.log(text.substring(0, 400) + '...');

    return {
      version,
      promptLength: prompt.length,
      response: text,
      responseLength: text.length,
      duration,
      accuracy,
      tone,
      usefulness,
      overallScore
    };
  } catch (e: any) {
    console.error(`실험 실패: ${e.message}`);
    return {
      version,
      promptLength: prompt.length,
      response: `ERROR: ${e.message}`,
      responseLength: 0,
      duration: Date.now() - start,
      accuracy: { verifiableFacts: [], suspiciousContent: [], hedgingExpressions: 0, sourcesMentioned: false, uncertaintyMarked: false },
      tone: { formalLevel: 'casual', casualExpressions: [], appropriateForReport: false },
      usefulness: { hasConcreteExamples: false, hasActionableAdvice: false, specificConcepts: [], practicalValue: 0 },
      overallScore: 0
    };
  }
};

// ========== 메인 ==========

const main = async () => {
  console.log('='.repeat(70));
  console.log('Curriculum 프롬프트 V3 실험 (유용성 + 정확성 + 톤)');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log(`모델: ${MODEL}`);
  console.log('='.repeat(70));

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results: ExperimentResult[] = [];

  // 병렬 실행
  const experiments = [
    { version: 'V1_방어적', prompt: promptV1_Defensive },
    { version: 'V2_캐주얼', prompt: promptV2_Casual },
    { version: 'V3_균형형', prompt: promptV3_Balanced },
    { version: 'V4_검증강화', prompt: promptV4_Verified }
  ];

  for (const exp of experiments) {
    results.push(await runExperiment(exp.version, exp.prompt));
    await new Promise(r => setTimeout(r, 3000));
  }

  // 결과 비교
  console.log('\n' + '='.repeat(70));
  console.log('실험 결과 비교');
  console.log('='.repeat(70));

  console.log('\n| 버전 | 프롬프트 | 응답 | 시간 | 정확성 | 톤 | 유용성 | 종합 |');
  console.log('|------|---------|------|------|--------|-----|--------|------|');

  results.forEach(r => {
    const accScore = (r.accuracy.uncertaintyMarked ? 1 : 0) + (r.accuracy.sourcesMentioned ? 1 : 0);
    console.log(`| ${r.version} | ${r.promptLength}자 | ${r.responseLength}자 | ${(r.duration/1000).toFixed(1)}s | ${accScore}/2 | ${r.tone.formalLevel} | ${r.usefulness.practicalValue}/5 | ${r.overallScore}/100 |`);
  });

  // 승자 판정
  const winner = results.reduce((best, curr) =>
    curr.overallScore > best.overallScore ? curr : best
  );

  console.log(`\n${'='.repeat(70)}`);
  console.log(`최적 버전: ${winner.version} (${winner.overallScore}/100점)`);
  console.log(`${'='.repeat(70)}`);

  // 결과 저장
  const outputDir = './test/results';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    `${outputDir}/curriculum_v3_accuracy_${Date.now()}.json`,
    JSON.stringify({
      experiment: 'curriculum_v3_accuracy',
      timestamp: new Date().toISOString(),
      results: results.map(r => ({
        ...r,
        response: r.response.substring(0, 1500) + '...'
      })),
      winner: winner.version
    }, null, 2),
    'utf-8'
  );

  // 최적 버전 응답 전체 출력 (검증용)
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${winner.version}] 전체 응답 (검증용)`);
  console.log('='.repeat(70));
  console.log(winner.response);
};

main().catch(console.error);
