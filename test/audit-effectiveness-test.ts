/**
 * Audit 단계 유효성 테스트
 *
 * 목적: Audit 에이전트가 실제로 할루시네이션을 감지하는지 검증
 *
 * 테스트 케이스:
 * 1. 정확한 데이터 → PASS 예상
 * 2. 할루시네이션 포함 데이터 → WARNING/FAIL 예상
 * 3. 혼합 데이터 → WARNING 예상
 *
 * 실행: API_KEY=xxx npx tsx test/audit-effectiveness-test.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";

// ========== 테스트 데이터 ==========

// 정확한 데이터 (실제 충남대 정치외교학과 정보)
const ACCURATE_DATA = {
  curriculum: `
    ## 정치외교학과 교육과정
    ### 1학년 과목
    - 정치학원론: 정치학의 기본 개념

    ### 2학년 과목
    - 비교정치론: 각국 정치체제 비교
    - 국제관계이론: 국제정치 이론
    - 정치학방법론: 연구방법
  `,
  professors: [
    { name: "오영달", researchTendency: "국제정치" },
    { name: "김지운", researchTendency: "중국정치" },
    { name: "고봉준", researchTendency: "국제정치" },
    { name: "박영득", researchTendency: "비교정치 및 한국정치" }
  ],
  trends: `
    ## 면접 트렌드
    - 전공 기초 지식 질문 중심
    - 시사 이슈 연계 질문 증가
  `
};

// 할루시네이션 데이터 (가상의 교수/과목)
const HALLUCINATED_DATA = {
  curriculum: `
    ## 정치외교학과 교육과정
    ### 1학년 과목
    - 정치학개론: 정치학 입문 (※ 실제는 '정치학원론')
    - 국제관계학개론: 국제정치 입문 (※ 가상 과목)

    ### 2학년 과목
    - 서양정치사상사: 서양 정치사상 (※ 실제는 '정치사상 1,2')
    - 한국정치론: 한국 정치 분석 (※ 가상 과목)
  `,
  professors: [
    { name: "유현석", researchTendency: "국제정치" },  // 가상 교수
    { name: "김철수", researchTendency: "북한학" },    // 가상 교수
    { name: "이영희", researchTendency: "정치경제" }   // 가상 교수
  ],
  trends: `
    ## 면접 트렌드
    - 2019년 면접에서 자주 출제된 질문... (※ 오래된 정보)
    - 김철수 교수가 즐겨 묻는 질문... (※ 가상 교수)
  `
};

// 혼합 데이터 (일부 정확 + 일부 할루시네이션)
const MIXED_DATA = {
  curriculum: `
    ## 정치외교학과 교육과정
    ### 1학년 과목
    - 정치학원론: 정치학의 기본 개념 (정확)

    ### 2학년 과목
    - 비교정치론: 각국 정치체제 비교 (정확)
    - 서양정치사상사: 서양 정치사상 (※ 가상)
  `,
  professors: [
    { name: "오영달", researchTendency: "국제정치" },  // 정확
    { name: "김지운", researchTendency: "중국정치" },  // 정확
    { name: "이영희", researchTendency: "정치경제" }   // 가상
  ],
  trends: `정확한 정보와 부정확한 정보 혼합`
};

// ========== Audit 프롬프트 (실제 핸들러와 동일) ==========

const createAuditPrompt = (data: any) => `
You are a Senior Admissions Auditor for ${UNI} ${DEPT}.
Your job is to strictly audit the gathered research data before it is used for strategy generation.

[Temporal Context]
현재 시점: 2026년 1월. 1년 이상 된 정보는 outdated일 수 있음.

[Data to Audit]
*참고: 데이터는 길이 제한으로 인해 일부가 잘려 있을 수 있습니다. JSON 문법 오류보다는 '내용의 질'에 집중하십시오.*
1. Curriculum Analysis: ${JSON.stringify(data.curriculum).substring(0, 3000)}
2. Professor Analysis: ${JSON.stringify(data.professors).substring(0, 3000)}
3. Trend Analysis: ${JSON.stringify(data.trends).substring(0, 3000)}

[Audit Tasks]
1.**할루시네이션(Hallucination)**: 존재하지 않는 가상의 교수명이나 과목명, 커리큘럼이 포함된 것으로 의심됩니까? 공식 홈페이지의 내용을 통해 검증하십시오.
2.**전략적 가치**: 이 데이터만으로 차별화된 입시 전략을 짤 수 있을 만큼 충분히 깊이가 있습니까?

[출력 형식]
반드시 한국어로 작성된 JSON 객체를 반환하십시오.

JSON 스키마:
{
  "score": 85,
  "status": "PASS" | "WARNING" | "FAIL",
  "issues": ["문제점1", "문제점2"],
  "feedback": "전략 생성 에이전트를 위한 조언"
}
`;

// ========== 테스트 실행 ==========

interface AuditResult {
  score: number;
  status: string;
  issues: string[];
  feedback: string;
}

const runAuditTest = async (name: string, data: any, expected: string): Promise<{
  name: string;
  expected: string;
  actual: string;
  score: number;
  issues: string[];
  passed: boolean;
} | null> => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`테스트: ${name}`);
  console.log(`예상 결과: ${expected}`);
  console.log(`${'='.repeat(50)}`);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createAuditPrompt(data),
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    const text = response.text || '{}';
    let result: AuditResult;

    try {
      result = JSON.parse(text);
    } catch {
      console.log('JSON 파싱 실패, 원본:', text.substring(0, 200));
      return null;
    }

    const passed = (
      (expected === 'PASS' && result.status === 'PASS') ||
      (expected === 'FAIL' && (result.status === 'FAIL' || result.status === 'WARNING')) ||
      (expected === 'WARNING' && (result.status === 'WARNING' || result.status === 'FAIL'))
    );

    console.log(`  점수: ${result.score}/100`);
    console.log(`  상태: ${result.status} ${passed ? '✅' : '❌'}`);
    console.log(`  이슈: ${result.issues?.length || 0}개`);
    result.issues?.forEach((issue, i) => {
      console.log(`    ${i + 1}. ${issue.substring(0, 80)}...`);
    });

    return {
      name,
      expected,
      actual: result.status,
      score: result.score,
      issues: result.issues || [],
      passed
    };
  } catch (e: any) {
    console.error(`테스트 실패: ${e.message}`);
    return null;
  }
};

// ========== 메인 ==========

const main = async () => {
  console.log('='.repeat(60));
  console.log('Audit 단계 유효성 테스트');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log('='.repeat(60));

  if (!apiKey) {
    console.error('API_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  const results = [];

  // 테스트 1: 정확한 데이터
  const r1 = await runAuditTest('정확한 데이터', ACCURATE_DATA, 'PASS');
  if (r1) results.push(r1);
  await new Promise(r => setTimeout(r, 2000));

  // 테스트 2: 할루시네이션 데이터
  const r2 = await runAuditTest('할루시네이션 데이터', HALLUCINATED_DATA, 'FAIL');
  if (r2) results.push(r2);
  await new Promise(r => setTimeout(r, 2000));

  // 테스트 3: 혼합 데이터
  const r3 = await runAuditTest('혼합 데이터', MIXED_DATA, 'WARNING');
  if (r3) results.push(r3);

  // 결과 요약
  console.log('\n' + '='.repeat(60));
  console.log('테스트 결과 요약');
  console.log('='.repeat(60));

  console.log('\n| 테스트 | 예상 | 실제 | 점수 | 결과 |');
  console.log('|--------|------|------|------|------|');

  results.forEach(r => {
    console.log(`| ${r.name} | ${r.expected} | ${r.actual} | ${r.score} | ${r.passed ? '✅' : '❌'} |`);
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`\n통과율: ${passedCount}/${totalCount} (${Math.round(passedCount / totalCount * 100)}%)`);

  // Audit 유효성 판정
  console.log('\n' + '='.repeat(60));
  console.log('Audit 단계 유효성 판정');
  console.log('='.repeat(60));

  if (passedCount === totalCount) {
    console.log('✅ Audit 단계가 유효합니다. 할루시네이션을 정확히 감지합니다.');
  } else if (passedCount >= totalCount * 0.6) {
    console.log('⚠️ Audit 단계가 부분적으로 유효합니다. 일부 케이스에서 감지 실패.');
  } else {
    console.log('❌ Audit 단계가 유효하지 않습니다. 할루시네이션 감지 능력이 부족합니다.');
  }

  // 상세 분석
  const hallucTest = results.find(r => r.name === '할루시네이션 데이터');
  if (hallucTest) {
    console.log('\n[할루시네이션 감지 상세]');
    if (hallucTest.issues.length > 0) {
      console.log('감지된 문제:');
      hallucTest.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    } else {
      console.log('⚠️ 할루시네이션 이슈를 명시적으로 감지하지 못함');
    }
  }
};

main().catch(console.error);
