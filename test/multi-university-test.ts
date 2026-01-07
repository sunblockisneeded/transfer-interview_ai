/**
 * 다양한 대학/학과 테스트
 *
 * 목적: R3 인용강제 프롬프트가 여러 대학/학과에서 일반화되는지 확인
 *
 * 실행: API_KEY=xxx npx tsx test/multi-university-test.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const currentYear = new Date().getFullYear();

// ========== 테스트 대상 ==========
const TEST_CASES = [
  { uni: "서울대학교", dept: "경제학부" },
  { uni: "연세대학교", dept: "심리학과" },
  { uni: "고려대학교", dept: "법학과" },
  { uni: "부산대학교", dept: "기계공학부" },
  { uni: "경희대학교", dept: "한의예과" },
  { uni: "한양대학교", dept: "건축학부" },
];

// 흔한 할루시네이션 패턴 (학과별)
const COMMON_HALLUCINATIONS: Record<string, string[]> = {
  "경제학부": ["경제학개론", "경제원론입문", "미시경제학개론"],
  "심리학과": ["심리학개론", "일반심리학입문", "기초심리학"],
  "법학과": ["법학개론", "민법개론", "헌법개론"],
  "기계공학부": ["기계공학개론", "역학개론"],
  "한의예과": ["한의학개론", "동양의학개론"],
  "건축학부": ["건축학개론", "건축설계입문"],
};

// ========== R3 인용강제 프롬프트 ==========
const createPrompt = (uni: string, dept: string) => `
"${uni} ${dept} 교육과정"을 검색한 뒤, 편입 면접 준비 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 학과 홈페이지를 검색하여 실제 과목명 확인
2. 과목명 옆에 [확인됨] 표시
3. 검색에서 확인 안 된 정보는 [미확인] 표시

[작성 내용]
### 핵심 전공 과목 (1-2학년)
| 과목명 | 핵심 개념 | 면접 예상 질문 |
|--------|----------|---------------|

### 학과 특색
- 이 학과만의 강점

### 면접 준비 핵심
- 반드시 알아야 할 개념 3개

[목적]
${currentYear}년 편입 면접 준비 학생이 "무엇을 공부해야 하는지" 알 수 있도록 작성
`;

// ========== 분석 함수 ==========
interface TestResult {
  uni: string;
  dept: string;
  hasConfirmTag: boolean;
  hasUnconfirmTag: boolean;
  hasTable: boolean;
  possibleHallucinations: string[];
  contentLength: number;
  usefulnessScore: number;
}

const analyzeResponse = (uni: string, dept: string, text: string): TestResult => {
  const hasConfirmTag = /\[확인됨?\]|\[확인\]/.test(text);
  const hasUnconfirmTag = /\[미확인\]/.test(text);
  const hasTable = text.includes('|') && text.includes('---');

  // 학과별 흔한 할루시네이션 체크
  const hallucPatterns = COMMON_HALLUCINATIONS[dept] || [];
  const possibleHallucinations = hallucPatterns.filter(h => text.includes(h));

  // 유용성 체크
  const hasConcepts = /핵심|개념|이론/.test(text);
  const hasQuestions = /질문|답변/.test(text);
  const hasStrategy = /준비|전략|특색|강점/.test(text);

  const usefulnessScore = [hasConfirmTag, hasTable, hasConcepts, hasQuestions, hasStrategy]
    .filter(Boolean).length;

  return {
    uni,
    dept,
    hasConfirmTag,
    hasUnconfirmTag,
    hasTable,
    possibleHallucinations,
    contentLength: text.length,
    usefulnessScore
  };
};

// ========== 단일 테스트 ==========
const runSingleTest = async (uni: string, dept: string): Promise<TestResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: createPrompt(uni, dept),
      config: { tools: [{ googleSearch: {} }] }
    });

    const text = response.text || '';
    return analyzeResponse(uni, dept, text);
  } catch (e: any) {
    console.error(`${uni} ${dept} 실패:`, e.message);
    return null;
  }
};

// ========== 메인 ==========
const main = async () => {
  console.log('='.repeat(70));
  console.log('다양한 대학/학과 테스트 (R3 인용강제 프롬프트)');
  console.log('='.repeat(70));

  if (!apiKey) {
    console.error('API_KEY 필요');
    process.exit(1);
  }

  console.log(`\n테스트 대상: ${TEST_CASES.length}개 (병렬 실행)`);
  TEST_CASES.forEach(tc => console.log(`  - ${tc.uni} ${tc.dept}`));

  // 병렬 실행
  const startTime = Date.now();
  const results = await Promise.all(
    TEST_CASES.map(tc => runSingleTest(tc.uni, tc.dept))
  );
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n완료: ${duration}초`);

  // 결과 분석
  const validResults = results.filter((r): r is TestResult => r !== null);

  console.log('\n' + '='.repeat(70));
  console.log('결과 분석');
  console.log('='.repeat(70));

  console.log('\n| 대학 | 학과 | [확인됨] | 표 | 유용성 | 의심 할루시네이션 |');
  console.log('|------|------|---------|-----|--------|------------------|');

  validResults.forEach(r => {
    const halluc = r.possibleHallucinations.length > 0
      ? r.possibleHallucinations.join(', ')
      : '없음';
    console.log(`| ${r.uni.substring(0, 6)} | ${r.dept.substring(0, 6)} | ${r.hasConfirmTag ? '✅' : '❌'} | ${r.hasTable ? '✅' : '❌'} | ${r.usefulnessScore}/5 | ${halluc} |`);
  });

  // 통계
  const confirmTagRate = validResults.filter(r => r.hasConfirmTag).length / validResults.length;
  const tableRate = validResults.filter(r => r.hasTable).length / validResults.length;
  const avgUsefulness = validResults.reduce((sum, r) => sum + r.usefulnessScore, 0) / validResults.length;
  const hallucCases = validResults.filter(r => r.possibleHallucinations.length > 0).length;

  console.log('\n' + '='.repeat(70));
  console.log('통계');
  console.log('='.repeat(70));
  console.log(`  [확인됨] 태그 사용률: ${(confirmTagRate * 100).toFixed(0)}%`);
  console.log(`  표 형식 사용률: ${(tableRate * 100).toFixed(0)}%`);
  console.log(`  평균 유용성: ${avgUsefulness.toFixed(1)}/5`);
  console.log(`  의심 할루시네이션: ${hallucCases}/${validResults.length}개 케이스`);

  // 판정
  console.log('\n[판정]');
  if (confirmTagRate >= 0.8 && hallucCases <= 1) {
    console.log('✅ R3 프롬프트가 다양한 학과에서 일반화됨');
  } else if (confirmTagRate >= 0.5) {
    console.log('⚠️ 부분적으로 효과적, 일부 학과에서 개선 필요');
  } else {
    console.log('❌ R3 프롬프트 일반화 실패, 학과별 조정 필요');
  }
};

main().catch(console.error);
