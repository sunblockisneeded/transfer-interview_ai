/**
 * Curriculum 프롬프트 V4 최종 실험
 *
 * 검증 결과 반영:
 * - 과목명이 부정확한 문제 해결
 * - 교수 전공 추측 방지
 * - 학과 특색 정확히 파악하도록 유도
 *
 * 실행: API_KEY=xxx npx tsx test/experiments/curriculum-v4-final.ts
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

// V3: 이전 최고 버전 (92점, 하지만 과목명 부정확)
const promptV3_Previous = `
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

// V4: 정확성 강화 (검색 결과 기반 + 정확한 과목명 강조)
const promptV4_Accurate = `
${UNI} ${DEPT} 편입 면접 준비 가이드를 작성합니다.

[검색 지시]
1. "${UNI} ${DEPT} 교육과정" 검색하여 **정확한 과목명** 확인
2. "${UNI} ${DEPT} 교수" 검색하여 교수진 전공 분야 확인
3. 학과 공식 홈페이지(polsci.cnu.ac.kr) 정보 우선 참조

[작성 원칙]
- 검색 결과에서 확인된 **정확한 과목명**만 사용 (추측하지 말 것)
- "정치학개론" 같은 일반적 명칭이 아닌, 해당 학과의 실제 과목명 사용
- 교수 전공 분야는 검색으로 확인된 것만 언급
- 확인 불가한 정보는 "※ 확인 필요" 표시

[출력 구조]
## ${DEPT} 편입 면접 가이드

### 1. 전공 기초 과목 (검색 결과 기반)
- 1학년 과목: (검색된 실제 과목명)
- 2학년 과목: (검색된 실제 과목명)

### 2. 학과 특색 및 강점
- 교수진 연구 분야 분석 (검색 결과 기반)
- 이 학과만의 특화 영역

### 3. 면접 대비 핵심 개념
- 각 과목에서 다루는 핵심 이론
- 예상 질문 및 답변 방향

### 4. 참고사항
- 출처 및 확인 필요 사항
`;

// V5: 검색 + 학과 특색 강조
const promptV5_Distinctive = `
${UNI} ${DEPT}의 교육과정과 학과 특색을 분석하여 편입 면접 가이드를 작성합니다.

[1단계: 정보 검색]
- "${UNI} ${DEPT} 교육과정 과목" 검색
- "${UNI} ${DEPT} 교수 연구분야" 검색
- 학과 홈페이지에서 정확한 과목명 확인

[2단계: 학과 특색 분석]
검색 결과를 바탕으로:
- 이 학과에서 특별히 강조하는 분야는? (중국정치? 국제안보? 비교정치?)
- 다른 대학 정치외교학과와 차별화되는 점은?

[3단계: 가이드 작성]
## ${UNI} ${DEPT} 편입 면접 가이드

### 교육과정 분석
| 학년 | 과목명 (실제) | 핵심 내용 | 면접 연결 |
|------|--------------|----------|----------|

### 학과 특색
- 교수진 전공 분포: (검색 결과)
- 강점 분야: (검색 결과 기반)

### 면접 예상 질문
- (학과 특색 반영)

### ※ 확인 필요 사항
- (불확실한 정보)

[작성 규칙]
- 반드시 검색 결과의 정확한 과목명 사용
- 추측하지 말고 "확인 필요" 표시
- 공식적인 톤 유지
`;

// ========== 실제 데이터 (검증용) ==========
const ACTUAL_DATA = {
  year1: ["정치학원론"],
  year2: [
    "비교정치경제", "북한정치론", "시민사회정치론", "환경및자원안보",
    "정치사상 2", "국제기구정치론", "중국정치론", "국제안보",
    "소수자정치", "국제관계이론", "동남아정치론", "선거와정당정치",
    "정치사상 1", "정치학방법론", "비교정치론"
  ],
  professors: [
    { name: "오영달", field: "국제정치" },
    { name: "김지운", field: "중국정치" },
    { name: "고봉준", field: "국제정치" },
    { name: "박영득", field: "비교정치 및 한국정치" },
    { name: "기여운", field: "비교정치" },
    { name: "김정현", field: "국제정치, 비교정치" },
    { name: "박수인", field: "서양정치사상" }
  ]
};

// ========== 정확성 검증 함수 ==========

interface AccuracyResult {
  correctCourses: string[];
  incorrectCourses: string[];
  correctProfessors: string[];
  incorrectProfessors: string[];
  accuracyScore: number;
  hasUncertaintyMarks: boolean;
  hasFormalTone: boolean;
}

const verifyAccuracy = (text: string): AccuracyResult => {
  const correctCourses: string[] = [];
  const incorrectCourses: string[] = [];

  // 실제 과목명 확인
  const allCourses = [...ACTUAL_DATA.year1, ...ACTUAL_DATA.year2];
  allCourses.forEach(course => {
    if (text.includes(course)) {
      correctCourses.push(course);
    }
  });

  // 잘못된/추측된 과목명 탐지
  const wrongPatterns = [
    "정치학개론", "국제관계학개론", "서양정치사상사",
    "국제정치학개론", "한국정치론", "정치사상사"
  ];
  wrongPatterns.forEach(wrong => {
    if (text.includes(wrong) && !allCourses.some(c => c === wrong)) {
      incorrectCourses.push(wrong);
    }
  });

  // 교수 이름 확인
  const correctProfessors: string[] = [];
  const incorrectProfessors: string[] = [];

  ACTUAL_DATA.professors.forEach(prof => {
    if (text.includes(prof.name)) {
      // 전공도 맞는지 확인
      if (text.includes(prof.field) || text.includes(prof.field.split(',')[0].trim())) {
        correctProfessors.push(`${prof.name}(${prof.field})`);
      } else {
        correctProfessors.push(prof.name);
      }
    }
  });

  // 불확실성 표시 여부
  const hasUncertaintyMarks = /확인 필요|※|정보 없음|검증 필요/.test(text);

  // 공식적 톤 여부
  const casualPatterns = /~어요|~해요|~죠|~야|선배|후배/g;
  const hasFormalTone = !(casualPatterns.test(text));

  // 정확성 점수 계산
  let accuracyScore = 0;

  // 정확한 과목 비율 (50점)
  const courseAccuracy = correctCourses.length / Math.max(1, correctCourses.length + incorrectCourses.length);
  accuracyScore += courseAccuracy * 50;

  // 잘못된 과목 페널티 (-10점 per wrong)
  accuracyScore -= incorrectCourses.length * 10;

  // 불확실성 표시 보너스 (20점)
  if (hasUncertaintyMarks) accuracyScore += 20;

  // 공식적 톤 보너스 (20점)
  if (hasFormalTone) accuracyScore += 20;

  // 교수 정보 정확성 (10점)
  if (correctProfessors.length > 0 && incorrectProfessors.length === 0) {
    accuracyScore += 10;
  }

  return {
    correctCourses,
    incorrectCourses,
    correctProfessors,
    incorrectProfessors,
    accuracyScore: Math.max(0, Math.min(100, accuracyScore)),
    hasUncertaintyMarks,
    hasFormalTone
  };
};

// ========== 실험 실행 ==========

const runExperiment = async (version: string, prompt: string) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`실험: ${version}`);
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
    const accuracy = verifyAccuracy(text);

    console.log(`\n[정확성 검증 - 실제 데이터 기반]`);
    console.log(`  ✅ 정확한 과목: ${accuracy.correctCourses.join(', ') || '없음'}`);
    console.log(`  ❌ 부정확한 과목: ${accuracy.incorrectCourses.join(', ') || '없음'}`);
    console.log(`  👨‍🏫 교수 언급: ${accuracy.correctProfessors.join(', ') || '없음'}`);
    console.log(`  📝 불확실성 표시: ${accuracy.hasUncertaintyMarks ? 'O' : 'X'}`);
    console.log(`  🎯 공식적 톤: ${accuracy.hasFormalTone ? 'O' : 'X'}`);
    console.log(`  📊 정확성 점수: ${accuracy.accuracyScore.toFixed(0)}/100`);

    console.log(`\n--- 응답 미리보기 (500자) ---`);
    console.log(text.substring(0, 500) + '...');

    return { version, text, duration, accuracy };
  } catch (e: any) {
    console.error(`실험 실패: ${e.message}`);
    return null;
  }
};

// ========== 메인 ==========

const main = async () => {
  console.log('='.repeat(70));
  console.log('Curriculum 프롬프트 V4 최종 실험 (실제 데이터 기반 검증)');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log('='.repeat(70));

  console.log('\n[검증용 실제 데이터]');
  console.log(`1학년: ${ACTUAL_DATA.year1.join(', ')}`);
  console.log(`2학년: ${ACTUAL_DATA.year2.slice(0, 8).join(', ')}...`);
  console.log(`교수진: ${ACTUAL_DATA.professors.map(p => p.name).join(', ')}`);

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results = [];

  // V3 (이전 최고)
  const r3 = await runExperiment('V3_이전최고', promptV3_Previous);
  if (r3) results.push(r3);
  await new Promise(r => setTimeout(r, 3000));

  // V4 (정확성 강화)
  const r4 = await runExperiment('V4_정확성강화', promptV4_Accurate);
  if (r4) results.push(r4);
  await new Promise(r => setTimeout(r, 3000));

  // V5 (학과 특색)
  const r5 = await runExperiment('V5_학과특색', promptV5_Distinctive);
  if (r5) results.push(r5);

  // 결과 비교
  console.log('\n' + '='.repeat(70));
  console.log('최종 결과 비교 (실제 데이터 기반)');
  console.log('='.repeat(70));

  console.log('\n| 버전 | 정확한 과목 | 부정확 과목 | 불확실성 | 톤 | 점수 |');
  console.log('|------|------------|-----------|---------|-----|------|');

  results.forEach(r => {
    console.log(`| ${r.version} | ${r.accuracy.correctCourses.length}개 | ${r.accuracy.incorrectCourses.length}개 | ${r.accuracy.hasUncertaintyMarks ? 'O' : 'X'} | ${r.accuracy.hasFormalTone ? '공식' : '캐주얼'} | ${r.accuracy.accuracyScore.toFixed(0)} |`);
  });

  const winner = results.reduce((best, curr) =>
    curr.accuracy.accuracyScore > best.accuracy.accuracyScore ? curr : best
  );

  console.log(`\n최적 버전: ${winner.version} (${winner.accuracy.accuracyScore.toFixed(0)}점)`);

  // 결과 저장
  const outputDir = './test/results';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    `${outputDir}/curriculum_v4_final_${Date.now()}.json`,
    JSON.stringify({
      actualData: ACTUAL_DATA,
      results: results.map(r => ({
        version: r.version,
        accuracy: r.accuracy,
        response: r.text.substring(0, 2000)
      })),
      winner: winner.version
    }, null, 2),
    'utf-8'
  );

  // 최적 버전 전체 출력
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${winner.version}] 전체 응답`);
  console.log('='.repeat(70));
  console.log(winner.text);
};

main().catch(console.error);
