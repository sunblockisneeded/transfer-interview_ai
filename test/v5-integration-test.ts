/**
 * V5 프롬프트 통합 테스트
 *
 * 핸들러에 적용된 V5 프롬프트가 정확한 결과를 내는지 검증
 *
 * 실행: API_KEY=xxx npx tsx test/v5-integration-test.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";
const currentYear = new Date().getFullYear();

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

// 잘못된 과목명 패턴
const WRONG_COURSES = [
  "정치학개론", "국제관계학개론", "서양정치사상사",
  "국제정치학개론", "한국정치론", "정치사상사"
];

// ========== 핸들러와 동일한 V5 프롬프트 ==========

const curriculumPrompt = `
${UNI} ${DEPT} 편입 면접 준비 가이드를 작성해주세요.

[대상] ${currentYear}년 또는 ${currentYear + 1}학년도 편입 준비생

[작성 내용]
1. 1-2학년 핵심 전공 과목과 각 과목의 면접 출제 개념
2. 학과 특색과 교수진 연구 분야
3. 면접 예상 질문과 답변 방향

[작성 원칙]
- 학과 홈페이지의 **실제 과목명**만 사용 (추측 금지)
- 교수 전공은 검색으로 확인된 것만 언급
- 확인되지 않은 정보는 "※ 확인 필요" 표시
- 공식적이고 신뢰할 수 있는 톤
`;

const professorsPrompt = `
${UNI} ${DEPT} 교수진 분석 및 면접 활용 가이드를 작성해주세요.

[작성 내용]
1. 교수별 연구 분야와 면접 연결점
2. 학과 전체의 강점 분야 (타 대학 대비)
3. 면접에서 교수진 특색 활용법

[출력 형식]
- **교수명** - 연구분야 → 면접 예상 질문

[작성 원칙]
- 학과 홈페이지의 **실제 교수명과 전공**만 사용
- 확인되지 않은 정보는 "※ 확인 필요" 표시
- 공식적이고 신뢰할 수 있는 톤
`;

// ========== 검증 함수 ==========

interface TestResult {
  handler: string;
  correctCourses: string[];
  incorrectCourses: string[];
  correctProfessors: string[];
  hasFormalTone: boolean;
  hasUncertaintyMarks: boolean;
  score: number;
}

const verifyResult = (handler: string, text: string): TestResult => {
  const allCourses = [...ACTUAL_DATA.year1, ...ACTUAL_DATA.year2];

  const correctCourses = allCourses.filter(c => text.includes(c));
  const incorrectCourses = WRONG_COURSES.filter(w =>
    text.includes(w) && !allCourses.includes(w)
  );

  const correctProfessors = ACTUAL_DATA.professors
    .filter(p => text.includes(p.name))
    .map(p => p.name);

  const casualPatterns = /~어요|~해요|~죠|~야(?![간-힣])|선배|후배/g;
  const hasFormalTone = !casualPatterns.test(text);
  const hasUncertaintyMarks = /확인 필요|※|정보 없음/.test(text);

  // 점수 계산
  let score = 0;
  score += correctCourses.length * 5; // 정확한 과목당 5점
  score -= incorrectCourses.length * 20; // 잘못된 과목당 -20점
  score += correctProfessors.length * 5; // 정확한 교수당 5점
  score += hasFormalTone ? 20 : 0;
  score += hasUncertaintyMarks ? 10 : 0;

  return {
    handler,
    correctCourses,
    incorrectCourses,
    correctProfessors,
    hasFormalTone,
    hasUncertaintyMarks,
    score: Math.max(0, score)
  };
};

// ========== 테스트 실행 ==========

const runTest = async (name: string, prompt: string): Promise<TestResult | null> => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`테스트: ${name}`);
  console.log(`${'='.repeat(50)}`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });

    const text = response.text || '';
    const result = verifyResult(name, text);

    console.log(`  ✅ 정확한 과목: ${result.correctCourses.length}개`);
    console.log(`  ❌ 부정확 과목: ${result.incorrectCourses.length}개 (${result.incorrectCourses.join(', ') || '없음'})`);
    console.log(`  👨‍🏫 교수 언급: ${result.correctProfessors.join(', ') || '없음'}`);
    console.log(`  📝 공식 톤: ${result.hasFormalTone ? 'O' : 'X'}`);
    console.log(`  ※ 불확실성 표시: ${result.hasUncertaintyMarks ? 'O' : 'X'}`);
    console.log(`  📊 점수: ${result.score}`);

    console.log(`\n--- 응답 미리보기 (300자) ---`);
    console.log(text.substring(0, 300) + '...');

    return result;
  } catch (e: any) {
    console.error(`테스트 실패: ${e.message}`);
    return null;
  }
};

// ========== 메인 ==========

const main = async () => {
  console.log('='.repeat(60));
  console.log('V5 프롬프트 통합 테스트');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results: TestResult[] = [];

  // Curriculum 테스트
  const r1 = await runTest('Curriculum (V5)', curriculumPrompt);
  if (r1) results.push(r1);
  await new Promise(r => setTimeout(r, 2000));

  // Professors 테스트
  const r2 = await runTest('Professors (V5)', professorsPrompt);
  if (r2) results.push(r2);

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('테스트 결과 요약');
  console.log('='.repeat(60));

  console.log('\n| 핸들러 | 정확 과목 | 부정확 | 교수 | 톤 | 점수 |');
  console.log('|--------|----------|--------|------|-----|------|');

  results.forEach(r => {
    console.log(`| ${r.handler} | ${r.correctCourses.length}개 | ${r.incorrectCourses.length}개 | ${r.correctProfessors.length}명 | ${r.hasFormalTone ? '공식' : '캐주얼'} | ${r.score} |`);
  });

  const allPassed = results.every(r => r.incorrectCourses.length === 0 && r.hasFormalTone);
  console.log(`\n${allPassed ? '✅ 모든 테스트 통과!' : '⚠️ 일부 테스트에서 문제 발견'}`);
};

main().catch(console.error);
