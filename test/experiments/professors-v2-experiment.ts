/**
 * Professors 프롬프트 근본적 재설계 실험
 *
 * 목적 재정의: "교수 정보 수집" → "면접관이 될 교수의 관심사 파악"
 *
 * 실행: API_KEY=xxx npx tsx test/experiments/professors-v2-experiment.ts
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from 'fs';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";

// ========== 프롬프트 버전들 ==========

// V1: 현재 버전 (JSON 구조 강제, 정보 수집형)
const promptV1 = `
[역할] 당신은 한국 대학 교수 연구 분석가입니다.

[분석 대상] ${UNI} ${DEPT} 교수진

[검색 전략]
1. "${UNI} ${DEPT} 교수진" 검색
2. 학과 홈페이지의 교수 페이지 참조

[작업]
각 교수에 대해 다음 정보를 수집하세요:
- 이름
- 연구실명
- 연구 분야
- 주요 논문

[품질 규칙]
- 논문은 반드시 제목이 확인된 것만 포함
- 확인 불가시 해당 필드에 null 반환
- "Unknown"이나 빈 정보 대신 null 사용
`;

// V2: 면접 연결형 (교수 관심사 → 예상 질문)
const promptV2 = `
${UNI} ${DEPT} 편입 면접을 준비 중입니다.

이 학과 교수님들이 어떤 연구를 하는지 알고 싶어요.
각 교수님의 연구 분야를 바탕으로,
면접에서 물어볼 수 있는 질문이 뭘지 예측해주세요.

예: "김OO 교수 - 국제안보 연구 → 면접에서 한미동맹 관련 질문 가능"
`;

// V3: 전략적 관점 (학과 연구 특색 파악)
const promptV3 = `
${UNI} ${DEPT}의 학과 특색을 파악하고 싶어요.

1. 이 학과 교수들이 주로 연구하는 분야가 뭔가요?
2. 다른 대학 정치외교학과와 비교해서 특별히 강한 분야가 있나요?
3. 이런 학과 특색을 면접에서 어떻게 활용할 수 있을까요?

학과 홈페이지에서 교수 연구 분야를 찾아서 분석해주세요.
`;

// ========== 실험 실행 ==========

interface ExperimentResult {
  version: string;
  promptLength: number;
  response: string;
  responseLength: number;
  duration: number;
  analysis: {
    professorCount: number;
    hasInterviewConnection: boolean;
    hasStrategicInsight: boolean;
    actionableAdvice: number;
    usefulnessScore: number;
  };
}

const analyzeResponse = (text: string): ExperimentResult['analysis'] => {
  // 교수 수 추정 (이름 패턴)
  const profPatterns = /교수|Professor|Prof\./gi;
  const profMatches = text.match(profPatterns);
  const professorCount = profMatches ? Math.min(profMatches.length / 2, 10) : 0;

  // 면접 연결 여부
  const interviewPatterns = [
    /면접/g, /질문/g, /물어볼/g, /대비/g, /준비/g
  ];
  const hasInterviewConnection = interviewPatterns.some(p => p.test(text));

  // 전략적 통찰 여부
  const strategicPatterns = [
    /특색/g, /강점/g, /특화/g, /차별/g, /활용/g, /어필/g
  ];
  const hasStrategicInsight = strategicPatterns.some(p => p.test(text));

  // 행동 가능한 조언 수
  const actionPatterns = [
    /~하세요/g, /~면 좋/g, /추천/g, /팁/g, /전략/g
  ];
  const actionableAdvice = actionPatterns.reduce(
    (sum, p) => sum + (text.match(p)?.length || 0), 0
  );

  // 유용성 점수
  let usefulnessScore = 1;
  if (professorCount >= 3) usefulnessScore++;
  if (hasInterviewConnection) usefulnessScore++;
  if (hasStrategicInsight) usefulnessScore++;
  if (actionableAdvice >= 3) usefulnessScore++;

  return {
    professorCount: Math.round(professorCount),
    hasInterviewConnection,
    hasStrategicInsight,
    actionableAdvice,
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
    console.log(`교수 언급: ~${analysis.professorCount}명`);
    console.log(`면접 연결: ${analysis.hasInterviewConnection ? 'O' : 'X'}`);
    console.log(`전략적 통찰: ${analysis.hasStrategicInsight ? 'O' : 'X'}`);
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
        professorCount: 0,
        hasInterviewConnection: false,
        hasStrategicInsight: false,
        actionableAdvice: 0,
        usefulnessScore: 0
      }
    };
  }
};

const main = async () => {
  console.log('='.repeat(60));
  console.log('Professors 프롬프트 근본적 재설계 실험');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log(`모델: ${MODEL}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results: ExperimentResult[] = [];

  // V1 실험
  results.push(await runExperiment('V1_정보수집형', promptV1));
  await new Promise(r => setTimeout(r, 3000));

  // V2 실험
  results.push(await runExperiment('V2_면접연결형', promptV2));
  await new Promise(r => setTimeout(r, 3000));

  // V3 실험
  results.push(await runExperiment('V3_전략적관점', promptV3));

  // 결과 비교
  console.log('\n' + '='.repeat(60));
  console.log('실험 결과 비교');
  console.log('='.repeat(60));

  console.log('\n| 버전 | 프롬프트 | 응답 | 시간 | 면접연결 | 전략통찰 | 유용성 |');
  console.log('|------|---------|------|------|---------|---------|--------|');

  results.forEach(r => {
    console.log(`| ${r.version} | ${r.promptLength}자 | ${r.responseLength}자 | ${(r.duration/1000).toFixed(1)}s | ${r.analysis.hasInterviewConnection ? 'O' : 'X'} | ${r.analysis.hasStrategicInsight ? 'O' : 'X'} | ${r.analysis.usefulnessScore}/5 |`);
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
    `${outputDir}/professors_v2_experiment_${Date.now()}.json`,
    JSON.stringify({ results, winner: winner.version }, null, 2),
    'utf-8'
  );
};

main().catch(console.error);
