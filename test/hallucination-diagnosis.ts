/**
 * 할루시네이션 원인 진단 테스트
 *
 * 목적: 할루시네이션이 왜 발생하고, 어디서 막을 수 있는지 파악
 *
 * 테스트 매트릭스:
 * - Research 프롬프트 3종 (R1, R2, R3)
 * - Audit 프롬프트 2종 (A1, A2)
 * - 병렬 실행으로 시간 절약
 *
 * 실행: API_KEY=xxx npx tsx test/hallucination-diagnosis.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";
const currentYear = new Date().getFullYear();

// ========== Ground Truth ==========
const CORRECT_COURSES = ["정치학원론", "비교정치경제", "북한정치론", "시민사회정치론",
  "환경및자원안보", "정치사상 2", "국제기구정치론", "중국정치론",
  "국제안보", "소수자정치", "국제관계이론", "동남아정치론",
  "선거와정당정치", "정치사상 1", "정치학방법론", "비교정치론"];

const WRONG_COURSES = ["정치학개론", "국제관계학개론", "서양정치사상사",
  "한국정치론", "정치사상사", "국제정치학개론"];

const CORRECT_PROFS = ["오영달", "김지운", "고봉준", "박영득", "기여운", "김정현", "박수인"];

// ========== Research 프롬프트 변형 ==========

const researchPrompts = {
  R1_현재V5: `
${UNI} ${DEPT} 편입 면접 준비 가이드를 작성해주세요.

[대상] ${currentYear}년 편입 준비생

[작성 내용]
1. 1-2학년 핵심 전공 과목과 면접 출제 개념
2. 학과 특색과 교수진 연구 분야

[작성 원칙]
- 학과 홈페이지의 **실제 과목명**만 사용 (추측 금지)
- 확인되지 않은 정보는 "※ 확인 필요" 표시
`,

  R2_명시적금지: `
${UNI} ${DEPT} 편입 면접 준비 가이드를 작성해주세요.

[중요 경고]
⚠️ 다음은 일반적인 정치학과 과목이며, ${UNI}에는 없을 수 있습니다:
- 정치학개론 (실제는 "정치학원론")
- 서양정치사상사 (실제는 "정치사상 1, 2")
- 한국정치론, 국제관계학개론

반드시 학과 홈페이지 검색 후 확인된 과목명만 사용하세요.

[작성 내용]
1. 1-2학년 핵심 전공 과목
2. 학과 특색
`,

  R3_인용강제: `
${UNI} ${DEPT} 교육과정을 검색하고 편입 면접 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 검색을 먼저 수행하세요
2. 검색 결과에서 확인된 과목명만 사용하세요
3. 과목명 옆에 [검색확인] 또는 [미확인] 표시를 붙이세요

[출력 형식]
### 확인된 과목
- 과목명 [검색확인]

### 면접 포인트
- 각 과목별 핵심 개념
`
};

// ========== Audit 프롬프트 변형 ==========

const auditPrompts = {
  A1_현재: (data: string) => `
You are an Auditor for ${UNI} ${DEPT}.
Audit this data for hallucinations.

[Data]
${data.substring(0, 4000)}

[Tasks]
1. 존재하지 않는 가상의 교수명이나 과목명이 있는지 검증
2. 공식 홈페이지 검색으로 확인

[Output JSON]
{
  "score": 0-100,
  "status": "PASS" | "WARNING" | "FAIL",
  "hallucinations": ["발견된 가상 정보"],
  "verified": ["검증된 정확한 정보"]
}
`,

  A2_구체적패턴: (data: string) => `
You are a Fact-Checker for ${UNI} ${DEPT}.

[알려진 할루시네이션 패턴]
⚠️ 다음 과목명은 ${UNI} ${DEPT}에 없는 것으로 알려져 있습니다:
- "정치학개론" → 실제는 "정치학원론"
- "서양정치사상사" → 실제는 "정치사상 1, 2"
- "한국정치론" → 존재하지 않음
- "국제관계학개론" → 존재하지 않음

[실제 교수진]
오영달, 김지운, 고봉준, 박영득, 기여운, 김정현, 박수인

[Data to Check]
${data.substring(0, 4000)}

[Tasks]
1. 위 패턴에 해당하는 할루시네이션이 있는지 확인
2. 목록에 없는 교수명이 있는지 확인

[Output JSON]
{
  "score": 0-100,
  "status": "PASS" | "WARNING" | "FAIL",
  "hallucinations": ["발견된 가상 정보"],
  "verified": ["검증된 정확한 정보"]
}
`
};

// ========== 검증 함수 ==========

interface VerifyResult {
  correct: string[];
  wrong: string[];
  profs: string[];
}

const verify = (text: string): VerifyResult => {
  const correct = CORRECT_COURSES.filter(c => text.includes(c));
  const wrong = WRONG_COURSES.filter(c => text.includes(c));
  const profs = CORRECT_PROFS.filter(p => text.includes(p));
  return { correct, wrong, profs };
};

// ========== 단일 테스트 실행 ==========

interface TestResult {
  id: string;
  researchType: string;
  auditType: string;
  research: VerifyResult;
  auditScore: number;
  auditStatus: string;
  auditDetected: string[];
  matchedDetection: boolean; // Audit이 실제 할루시네이션을 감지했는가
}

const runSingleTest = async (
  researchType: string,
  researchPrompt: string,
  auditType: string,
  auditPromptFn: (data: string) => string
): Promise<TestResult | null> => {
  const id = `${researchType}_${auditType}`;

  try {
    // 1. Research 실행
    const researchResp = await ai.models.generateContent({
      model: MODEL,
      contents: researchPrompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    const researchText = researchResp.text || '';
    const researchVerify = verify(researchText);

    // 2. Audit 실행
    const auditResp = await ai.models.generateContent({
      model: MODEL,
      contents: auditPromptFn(researchText),
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    let auditResult: any;
    try {
      auditResult = JSON.parse(auditResp.text || '{}');
    } catch {
      auditResult = { score: 0, status: 'ERROR', hallucinations: [] };
    }

    // 3. Audit이 실제 할루시네이션을 감지했는지 확인
    const detectedHalluc = auditResult.hallucinations || [];
    const matchedDetection = researchVerify.wrong.length > 0 &&
      (auditResult.status !== 'PASS' || detectedHalluc.some((h: string) =>
        researchVerify.wrong.some(w => h.includes(w))
      ));

    return {
      id,
      researchType,
      auditType,
      research: researchVerify,
      auditScore: auditResult.score || 0,
      auditStatus: auditResult.status || 'UNKNOWN',
      auditDetected: detectedHalluc,
      matchedDetection
    };
  } catch (e: any) {
    console.error(`${id} 실패:`, e.message);
    return null;
  }
};

// ========== 메인 ==========

const main = async () => {
  console.log('='.repeat(70));
  console.log('할루시네이션 원인 진단 테스트');
  console.log('='.repeat(70));

  if (!apiKey) {
    console.error('API_KEY 필요');
    process.exit(1);
  }

  // 테스트 조합 생성
  const testCases: Array<{
    researchType: string;
    researchPrompt: string;
    auditType: string;
    auditPromptFn: (data: string) => string;
  }> = [];

  for (const [rType, rPrompt] of Object.entries(researchPrompts)) {
    for (const [aType, aFn] of Object.entries(auditPrompts)) {
      testCases.push({
        researchType: rType,
        researchPrompt: rPrompt,
        auditType: aType,
        auditPromptFn: aFn
      });
    }
  }

  console.log(`\n총 ${testCases.length}개 테스트 조합 (병렬 실행)`);
  console.log('-'.repeat(70));

  // 병렬 실행
  const startTime = Date.now();
  const results = await Promise.all(
    testCases.map(tc => runSingleTest(
      tc.researchType,
      tc.researchPrompt,
      tc.auditType,
      tc.auditPromptFn
    ))
  );
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n실행 완료: ${duration}초`);

  // 결과 분석
  const validResults = results.filter((r): r is TestResult => r !== null);

  console.log('\n' + '='.repeat(70));
  console.log('결과 분석');
  console.log('='.repeat(70));

  // 1. Research 프롬프트별 할루시네이션 발생률
  console.log('\n[1] Research 프롬프트별 할루시네이션 발생률');
  console.log('-'.repeat(50));

  const researchStats: Record<string, { total: number; wrongSum: number; correctSum: number }> = {};

  for (const r of validResults) {
    if (!researchStats[r.researchType]) {
      researchStats[r.researchType] = { total: 0, wrongSum: 0, correctSum: 0 };
    }
    researchStats[r.researchType].total++;
    researchStats[r.researchType].wrongSum += r.research.wrong.length;
    researchStats[r.researchType].correctSum += r.research.correct.length;
  }

  console.log('| Research 프롬프트 | 부정확 과목 (평균) | 정확 과목 (평균) |');
  console.log('|-------------------|-------------------|------------------|');
  for (const [rType, stats] of Object.entries(researchStats)) {
    const avgWrong = (stats.wrongSum / stats.total).toFixed(1);
    const avgCorrect = (stats.correctSum / stats.total).toFixed(1);
    console.log(`| ${rType.padEnd(17)} | ${avgWrong.padStart(17)} | ${avgCorrect.padStart(16)} |`);
  }

  // 2. Audit 프롬프트별 감지율
  console.log('\n[2] Audit 프롬프트별 감지 성공률');
  console.log('-'.repeat(50));

  const auditStats: Record<string, { total: number; detected: number; hasHalluc: number }> = {};

  for (const r of validResults) {
    if (!auditStats[r.auditType]) {
      auditStats[r.auditType] = { total: 0, detected: 0, hasHalluc: 0 };
    }
    auditStats[r.auditType].total++;
    if (r.research.wrong.length > 0) {
      auditStats[r.auditType].hasHalluc++;
      if (r.matchedDetection) {
        auditStats[r.auditType].detected++;
      }
    }
  }

  console.log('| Audit 프롬프트 | 할루시네이션 케이스 | 감지 성공 | 감지율 |');
  console.log('|----------------|--------------------| ----------|--------|');
  for (const [aType, stats] of Object.entries(auditStats)) {
    const rate = stats.hasHalluc > 0 ? ((stats.detected / stats.hasHalluc) * 100).toFixed(0) : 'N/A';
    console.log(`| ${aType.padEnd(14)} | ${String(stats.hasHalluc).padStart(18)} | ${String(stats.detected).padStart(9)} | ${rate.padStart(5)}% |`);
  }

  // 3. 상세 결과
  console.log('\n[3] 상세 결과');
  console.log('-'.repeat(70));

  console.log('| ID | 정확 | 부정확 | Audit | 감지 |');
  console.log('|----|------|--------|-------|------|');
  for (const r of validResults) {
    const detected = r.matchedDetection ? '✅' : (r.research.wrong.length > 0 ? '❌' : '-');
    console.log(`| ${r.id.substring(0, 20).padEnd(20)} | ${String(r.research.correct.length).padStart(4)} | ${String(r.research.wrong.length).padStart(6)} | ${r.auditStatus.padStart(5)} | ${detected.padStart(4)} |`);
  }

  // 4. 핵심 발견
  console.log('\n' + '='.repeat(70));
  console.log('핵심 발견');
  console.log('='.repeat(70));

  // 가장 좋은 Research 프롬프트
  const bestResearch = Object.entries(researchStats).reduce((best, [type, stats]) => {
    const avgWrong = stats.wrongSum / stats.total;
    if (!best || avgWrong < best.avgWrong) {
      return { type, avgWrong };
    }
    return best;
  }, null as { type: string; avgWrong: number } | null);

  // 가장 좋은 Audit 프롬프트
  const bestAudit = Object.entries(auditStats).reduce((best, [type, stats]) => {
    const rate = stats.hasHalluc > 0 ? stats.detected / stats.hasHalluc : 0;
    if (!best || rate > best.rate) {
      return { type, rate };
    }
    return best;
  }, null as { type: string; rate: number } | null);

  console.log(`\n1. 최적 Research 프롬프트: ${bestResearch?.type}`);
  console.log(`   → 평균 부정확 과목: ${bestResearch?.avgWrong.toFixed(1)}개`);

  console.log(`\n2. 최적 Audit 프롬프트: ${bestAudit?.type}`);
  console.log(`   → 감지율: ${((bestAudit?.rate || 0) * 100).toFixed(0)}%`);

  // 전략 제안
  console.log('\n[전략 제안]');
  const avgWrongAll = validResults.reduce((sum, r) => sum + r.research.wrong.length, 0) / validResults.length;
  const auditDetectionRate = validResults.filter(r => r.research.wrong.length > 0 && r.matchedDetection).length /
    Math.max(1, validResults.filter(r => r.research.wrong.length > 0).length);

  if (avgWrongAll < 1) {
    console.log('✅ Research 프롬프트가 효과적: 할루시네이션 발생률 낮음');
    console.log('   → Audit 단계 제거 가능');
  } else if (auditDetectionRate > 0.5) {
    console.log('⚠️ 할루시네이션 발생하지만 Audit이 감지함');
    console.log('   → Research 프롬프트 강화 + Audit 유지');
  } else {
    console.log('❌ 할루시네이션 발생하고 Audit도 감지 못함');
    console.log('   → Research 프롬프트 근본적 개선 필요');
    console.log('   → 또는 외부 검증 (크롤링) 도입 검토');
  }
};

main().catch(console.error);
