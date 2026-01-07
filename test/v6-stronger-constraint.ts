/**
 * V6 강화된 제약 테스트
 *
 * 할루시네이션 방지를 위한 더 강력한 프롬프트 전략:
 * 1. "일반적인 정치학 과목이 아닌" 명시
 * 2. 검색 결과 인용 요청
 * 3. 확인 불가 시 생략 지시
 *
 * 실행: API_KEY=xxx npx tsx test/v6-stronger-constraint.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";
const currentYear = new Date().getFullYear();

// 실제 데이터
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

const WRONG_COURSES = [
  "정치학개론", "국제관계학개론", "서양정치사상사",
  "국제정치학개론", "한국정치론", "정치사상사"
];

// ========== 프롬프트 버전들 ==========

// V5 (현재 핸들러): 기본 제약
const promptV5 = `
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

// V6A: 명시적 금지 + 검색 강조
const promptV6A = `
${UNI} ${DEPT} 편입 면접 준비 가이드를 작성해주세요.

[대상] ${currentYear}년 편입 준비생

[중요 제약]
⚠️ 아래 과목명은 일반적인 정치학과 과목이며, ${UNI} ${DEPT}에는 없을 수 있습니다:
- 정치학개론, 국제관계학개론, 서양정치사상사, 한국정치론

반드시 "${UNI} ${DEPT} 교육과정" 검색 결과에서 확인된 **정확한 과목명**만 사용하세요.
검색 결과에서 확인되지 않는 과목은 언급하지 마세요.

[작성 내용]
1. 1-2학년 핵심 전공 과목 (검색 결과 기반)
2. 학과 특색과 교수진 연구 분야
3. 면접 예상 질문

[작성 원칙]
- 검색 결과에서 확인된 정보만 사용
- 공식적인 톤
`;

// V6B: 검색 결과 인용 강제
const promptV6B = `
${UNI} ${DEPT} 교육과정을 검색하고, 검색 결과를 기반으로 편입 면접 가이드를 작성해주세요.

[검색 후 작성]
1. 먼저 "${UNI} ${DEPT} 교육과정"을 검색하세요
2. 검색 결과에서 확인된 과목명을 [출처: 검색결과] 형식으로 인용하세요
3. 검색에서 확인되지 않은 정보는 작성하지 마세요

[출력 형식]
### 확인된 과목
- 과목명 [출처: 검색결과]

### 면접 대비 포인트
- 각 과목별 핵심 개념

### 확인 필요
- 검색에서 확인되지 않은 사항

[원칙]
- 추측 금지, 검색 결과만 사용
- 공식적 톤
`;

// V6C: 최소주의 (가장 짧은 프롬프트)
const promptV6C = `
${UNI} ${DEPT} 학과 홈페이지에서 교육과정을 검색한 뒤,
확인된 과목명만 사용하여 편입 면접 가이드를 작성해주세요.

검색 결과에 없는 일반적인 과목명(정치학개론, 국제관계학개론 등)은 사용하지 마세요.
`;

// ========== 검증 ==========

const verify = (text: string) => {
  const allCourses = [...ACTUAL_DATA.year1, ...ACTUAL_DATA.year2];
  const correct = allCourses.filter(c => text.includes(c));
  const wrong = WRONG_COURSES.filter(w => text.includes(w) && !allCourses.includes(w));
  const profs = ACTUAL_DATA.professors.filter(p => text.includes(p.name)).map(p => p.name);

  return { correct, wrong, profs };
};

// ========== 실행 ==========

const runTest = async (name: string, prompt: string) => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${name}`);
  console.log(`${'='.repeat(50)}`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });

    const text = response.text || '';
    const { correct, wrong, profs } = verify(text);

    console.log(`✅ 정확: ${correct.length}개 (${correct.slice(0, 5).join(', ')}...)`);
    console.log(`❌ 부정확: ${wrong.length}개 (${wrong.join(', ') || '없음'})`);
    console.log(`👨‍🏫 교수: ${profs.join(', ') || '없음'}`);

    return { name, correct: correct.length, wrong: wrong.length, profs: profs.length };
  } catch (e: any) {
    console.error(`실패: ${e.message}`);
    return null;
  }
};

const main = async () => {
  console.log('V6 강화된 제약 테스트\n');

  if (!apiKey) {
    console.error('API_KEY 필요');
    process.exit(1);
  }

  const results = [];

  const r1 = await runTest('V5 (현재)', promptV5);
  if (r1) results.push(r1);
  await new Promise(r => setTimeout(r, 2000));

  const r2 = await runTest('V6A (명시적 금지)', promptV6A);
  if (r2) results.push(r2);
  await new Promise(r => setTimeout(r, 2000));

  const r3 = await runTest('V6B (인용 강제)', promptV6B);
  if (r3) results.push(r3);
  await new Promise(r => setTimeout(r, 2000));

  const r4 = await runTest('V6C (최소주의)', promptV6C);
  if (r4) results.push(r4);

  console.log('\n' + '='.repeat(50));
  console.log('결과 비교');
  console.log('='.repeat(50));
  console.log('\n| 버전 | 정확 | 부정확 | 교수 |');
  console.log('|------|------|--------|------|');
  results.forEach(r => {
    console.log(`| ${r.name} | ${r.correct} | ${r.wrong} | ${r.profs} |`);
  });

  const best = results.reduce((a, b) => {
    const scoreA = a.correct * 5 - a.wrong * 20 + a.profs * 5;
    const scoreB = b.correct * 5 - b.wrong * 20 + b.profs * 5;
    return scoreB > scoreA ? b : a;
  });

  console.log(`\n최적: ${best.name}`);
};

main().catch(console.error);
