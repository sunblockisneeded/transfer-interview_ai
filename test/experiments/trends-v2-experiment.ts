/**
 * Trends 프롬프트 근본적 재설계 실험
 *
 * 목적 재정의: "합격/불합격 사례 나열" → "실제 합격자의 전략 추출"
 *
 * 실행: API_KEY=xxx npx tsx test/experiments/trends-v2-experiment.ts
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

// V1: 현재 버전 (구조화된 체크리스트형)
const promptV1 = `
[역할] 당신은 편입 면접 트렌드 분석 전문가입니다.

[분석 대상] ${UNI} ${DEPT}

# 5. 합격 사례 분석
## 5.1 합격자 공통 특성
## 5.2 성공 요인 분석
| 성공 요인 | 구체적 사례 | 적용 팁 |
|----------|------------|--------|

# 6. ${UNI} 특화 정보
## 6.1 면접 특징
## 6.2 꿀팁
## 6.3 체크리스트
- [ ] 교수진 연구 분야 파악
- [ ] 학과 커리큘럼 특징 숙지

# 7. 불합격 사례 및 Contrary Thinking
## 7.1 치명적 실수
| 실수 유형 | 구체적 예시 | 왜 치명적인가 |
|----------|------------|--------------|

# 8. 실전 면접 대비
## 8.1 예상 질문 유형
## 8.2 최근 시사 이슈

[출력 규칙]
- 마크다운만 사용
- 검색 기반 정보만 작성
`;

// V2: 스토리텔링형 (합격자 이야기)
const promptV2 = `
${UNI} ${DEPT} 편입에 합격한 사람들의 이야기를 찾아주세요.

1. 어떤 배경(전적대, 전공)을 가진 사람들이 합격했나요?
2. 그들은 면접을 어떻게 준비했나요?
3. 면접에서 어떤 질문을 받았고, 어떻게 대답했나요?
4. 합격의 결정적 요인은 뭐였다고 본인들이 말하나요?

실제 후기나 인터뷰에서 발췌해서 생생하게 전달해주세요.
`;

// V3: 실전 코칭형 (선배의 조언)
const promptV3 = `
너는 ${UNI} ${DEPT} 편입 면접 전문 코치야.
${currentYear}년에 면접 보는 학생한테 실전 조언을 해줘.

"면접 한 달 전에 뭘 해야 해요?" 라고 물어봤어.

1. 가장 먼저 준비해야 할 것
2. 일주일 전 체크리스트
3. 면접 당일 주의사항
4. 실제로 나왔던 질문 + 모범 답변 예시

경험에서 우러나온 실전 조언으로 답해줘.
`;

// ========== 실험 실행 ==========

interface ExperimentResult {
  version: string;
  promptLength: number;
  response: string;
  responseLength: number;
  duration: number;
  analysis: {
    hasRealExamples: boolean;
    hasActionablePlan: boolean;
    hasSampleQA: boolean;
    naturalTone: boolean;
    usefulnessScore: number;
  };
}

const analyzeResponse = (text: string): ExperimentResult['analysis'] => {
  // 실제 사례/후기 언급
  const realExamplePatterns = [
    /후기/g, /합격자/g, /합격생/g, /실제로/g,
    /경험/g, /했었/g, /봤는데/g
  ];
  const hasRealExamples = realExamplePatterns.some(p => p.test(text));

  // 실행 가능한 계획
  const actionPatterns = [
    /~하세요/g, /준비/g, /체크/g, /일주일/g, /당일/g,
    /먼저/g, /그 다음/g, /마지막/g
  ];
  const actionCount = actionPatterns.reduce(
    (sum, p) => sum + (text.match(p)?.length || 0), 0
  );
  const hasActionablePlan = actionCount >= 5;

  // 예상 질문 + 답변 예시
  const qaPatterns = [
    /질문.*답변/g, /Q.*A/g, /예시.*답/g,
    /이렇게 답/g, /이런 식으로/g
  ];
  const hasSampleQA = qaPatterns.some(p => p.test(text));

  // 자연스러운 톤
  const informalPatterns = [
    /~거든/g, /~죠/g, /~해요/g, /솔직히/g, /사실/g,
    /~야/g, /~줘/g, /~할게/g
  ];
  const naturalTone = informalPatterns.some(p => p.test(text));

  // 유용성 점수
  let usefulnessScore = 1;
  if (hasRealExamples) usefulnessScore++;
  if (hasActionablePlan) usefulnessScore++;
  if (hasSampleQA) usefulnessScore++;
  if (naturalTone) usefulnessScore++;

  return {
    hasRealExamples,
    hasActionablePlan,
    hasSampleQA,
    naturalTone,
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
    console.log(`실제 사례: ${analysis.hasRealExamples ? 'O' : 'X'}`);
    console.log(`실행 계획: ${analysis.hasActionablePlan ? 'O' : 'X'}`);
    console.log(`Q&A 예시: ${analysis.hasSampleQA ? 'O' : 'X'}`);
    console.log(`자연스러운 톤: ${analysis.naturalTone ? 'O' : 'X'}`);
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
        hasRealExamples: false,
        hasActionablePlan: false,
        hasSampleQA: false,
        naturalTone: false,
        usefulnessScore: 0
      }
    };
  }
};

const main = async () => {
  console.log('='.repeat(60));
  console.log('Trends 프롬프트 근본적 재설계 실험');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log(`모델: ${MODEL}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results: ExperimentResult[] = [];

  // V1 실험
  results.push(await runExperiment('V1_구조화체크리스트', promptV1));
  await new Promise(r => setTimeout(r, 3000));

  // V2 실험
  results.push(await runExperiment('V2_스토리텔링', promptV2));
  await new Promise(r => setTimeout(r, 3000));

  // V3 실험
  results.push(await runExperiment('V3_실전코칭', promptV3));

  // 결과 비교
  console.log('\n' + '='.repeat(60));
  console.log('실험 결과 비교');
  console.log('='.repeat(60));

  console.log('\n| 버전 | 프롬프트 | 응답 | 시간 | 실제사례 | Q&A예시 | 자연스러움 | 유용성 |');
  console.log('|------|---------|------|------|---------|---------|----------|--------|');

  results.forEach(r => {
    console.log(`| ${r.version} | ${r.promptLength}자 | ${r.responseLength}자 | ${(r.duration/1000).toFixed(1)}s | ${r.analysis.hasRealExamples ? 'O' : 'X'} | ${r.analysis.hasSampleQA ? 'O' : 'X'} | ${r.analysis.naturalTone ? 'O' : 'X'} | ${r.analysis.usefulnessScore}/5 |`);
  });

  // 승자 판정
  const winner = results.reduce((best, curr) =>
    curr.analysis.usefulnessScore > best.analysis.usefulnessScore ? curr : best
  );

  console.log(`\n최적 버전: ${winner.version}`);

  // 결과 저장
  const outputDir = './test/results';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    `${outputDir}/trends_v2_experiment_${Date.now()}.json`,
    JSON.stringify({ results, winner: winner.version }, null, 2),
    'utf-8'
  );
};

main().catch(console.error);
