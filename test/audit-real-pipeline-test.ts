/**
 * Audit 실효성 테스트
 *
 * 핵심 질문: 같은 Gemini가 만든 데이터를 같은 Gemini가 검증할 때,
 * 실제로 할루시네이션을 잡아낼 수 있는가?
 *
 * 테스트 흐름:
 * 1. 실제 파이프라인처럼 curriculum/professors/trends 데이터 생성
 * 2. 생성된 데이터를 Audit에 넣어 검증
 * 3. Audit 결과 분석 + 수동 검증과 비교
 *
 * 실행: API_KEY=xxx npx tsx test/audit-real-pipeline-test.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";
const currentYear = new Date().getFullYear();

// ========== 실제 데이터 (수동 검증용) ==========
const GROUND_TRUTH = {
  courses: ["정치학원론", "비교정치경제", "북한정치론", "시민사회정치론",
            "환경및자원안보", "정치사상 2", "국제기구정치론", "중국정치론",
            "국제안보", "소수자정치", "국제관계이론", "동남아정치론",
            "선거와정당정치", "정치사상 1", "정치학방법론", "비교정치론"],
  wrongCourses: ["정치학개론", "국제관계학개론", "서양정치사상사", "한국정치론", "정치사상사"],
  professors: ["오영달", "김지운", "고봉준", "박영득", "기여운", "김정현", "박수인"]
};

// ========== 실제 파이프라인 프롬프트 (V5) ==========

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

const trendsPrompt = `
${UNI} ${DEPT} 편입 면접 실전 가이드를 작성해주세요.

[대상] ${currentYear}년 또는 ${currentYear + 1}학년도 편입 면접 준비생

[작성 내용]
1. 면접 준비 타임라인 (1개월 전 → 1주일 전 → 당일)
2. 실제 기출 질문과 모범 답변 방향
3. 합격자 공통점과 불합격 사유

[작성 원칙]
- 면접 후기/합격 수기 검색하여 **실제 사례** 기반으로 작성
- 확인되지 않은 정보는 "※ 확인 필요" 표시
- 공식적이고 신뢰할 수 있는 톤
`;

// ========== Audit 프롬프트 ==========

const createAuditPrompt = (curriculum: string, professors: string, trends: string) => `
You are a Senior Admissions Auditor for ${UNI} ${DEPT}.
Your job is to strictly audit the gathered research data before it is used for strategy generation.

[Temporal Context]
현재 시점: ${currentYear}년 1월. 1년 이상 된 정보는 outdated일 수 있음.

[Data to Audit]
*참고: 데이터는 길이 제한으로 인해 일부가 잘려 있을 수 있습니다.*
1. Curriculum Analysis: ${curriculum.substring(0, 3000)}
2. Professor Analysis: ${professors.substring(0, 3000)}
3. Trend Analysis: ${trends.substring(0, 3000)}

[Audit Tasks]
1.**할루시네이션(Hallucination)**: 존재하지 않는 가상의 교수명이나 과목명이 포함되어 있습니까? 공식 홈페이지를 검색하여 검증하십시오.
2.**전략적 가치**: 이 데이터가 면접 전략 수립에 충분히 유용합니까?

[출력 형식]
JSON:
{
  "score": 0-100,
  "status": "PASS" | "WARNING" | "FAIL",
  "issues": ["문제점1", ...],
  "detectedHallucinations": ["가상 교수/과목 목록"],
  "feedback": "조언"
}
`;

// ========== 수동 검증 함수 ==========

const manualVerify = (text: string) => {
  const foundCorrect = GROUND_TRUTH.courses.filter(c => text.includes(c));
  const foundWrong = GROUND_TRUTH.wrongCourses.filter(c => text.includes(c));
  const foundProfs = GROUND_TRUTH.professors.filter(p => text.includes(p));

  // 알려지지 않은 교수명 찾기 (패턴: X교수, 교수 X)
  const profPattern = /([가-힣]{2,4})\s*교수/g;
  const mentionedProfs: string[] = [];
  let match;
  while ((match = profPattern.exec(text)) !== null) {
    mentionedProfs.push(match[1]);
  }
  const unknownProfs = mentionedProfs.filter(p => !GROUND_TRUTH.professors.includes(p));

  return { foundCorrect, foundWrong, foundProfs, unknownProfs };
};

// ========== 메인 테스트 ==========

const main = async () => {
  console.log('='.repeat(70));
  console.log('Audit 실효성 테스트: 같은 Gemini가 만든 데이터를 Gemini가 검증');
  console.log(`대상: ${UNI} ${DEPT}`);
  console.log('='.repeat(70));

  if (!apiKey) {
    console.error('API_KEY 필요');
    process.exit(1);
  }

  // ========== Step 1: 실제 파이프라인처럼 데이터 생성 ==========
  console.log('\n[Step 1] Research 단계 시뮬레이션 (데이터 생성)');
  console.log('-'.repeat(50));

  let curriculumData = '';
  let professorsData = '';
  let trendsData = '';

  try {
    console.log('  Curriculum 생성 중...');
    const currResp = await ai.models.generateContent({
      model: MODEL,
      contents: curriculumPrompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    curriculumData = currResp.text || '';
    console.log(`  ✓ Curriculum: ${curriculumData.length}자`);

    await new Promise(r => setTimeout(r, 1000));

    console.log('  Professors 생성 중...');
    const profResp = await ai.models.generateContent({
      model: MODEL,
      contents: professorsPrompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    professorsData = profResp.text || '';
    console.log(`  ✓ Professors: ${professorsData.length}자`);

    await new Promise(r => setTimeout(r, 1000));

    console.log('  Trends 생성 중...');
    const trendResp = await ai.models.generateContent({
      model: MODEL,
      contents: trendsPrompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    trendsData = trendResp.text || '';
    console.log(`  ✓ Trends: ${trendsData.length}자`);

  } catch (e: any) {
    console.error('데이터 생성 실패:', e.message);
    process.exit(1);
  }

  // ========== Step 2: 수동 검증 (Ground Truth 비교) ==========
  console.log('\n[Step 2] 수동 검증 (Ground Truth 비교)');
  console.log('-'.repeat(50));

  const allText = curriculumData + professorsData + trendsData;
  const manual = manualVerify(allText);

  console.log(`  정확한 과목: ${manual.foundCorrect.length}개`);
  console.log(`    → ${manual.foundCorrect.slice(0, 5).join(', ')}...`);
  console.log(`  부정확 과목: ${manual.foundWrong.length}개`);
  if (manual.foundWrong.length > 0) {
    console.log(`    → ${manual.foundWrong.join(', ')} ⚠️ 할루시네이션!`);
  }
  console.log(`  정확한 교수: ${manual.foundProfs.length}명`);
  console.log(`    → ${manual.foundProfs.join(', ')}`);
  console.log(`  미확인 교수: ${manual.unknownProfs.length}명`);
  if (manual.unknownProfs.length > 0) {
    console.log(`    → ${[...new Set(manual.unknownProfs)].join(', ')} ⚠️ 할루시네이션?`);
  }

  const hasHallucinations = manual.foundWrong.length > 0 || manual.unknownProfs.length > 0;
  console.log(`\n  📊 수동 검증 결과: ${hasHallucinations ? '❌ 할루시네이션 발견' : '✅ 할루시네이션 없음'}`);

  // ========== Step 3: Audit 실행 ==========
  console.log('\n[Step 3] Audit 단계 실행');
  console.log('-'.repeat(50));

  let auditResult: any = null;

  try {
    const auditResp = await ai.models.generateContent({
      model: MODEL,
      contents: createAuditPrompt(curriculumData, professorsData, trendsData),
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    try {
      auditResult = JSON.parse(auditResp.text || '{}');
    } catch {
      console.log('  JSON 파싱 실패');
      auditResult = { score: 0, status: 'ERROR', issues: ['파싱 실패'] };
    }

    console.log(`  점수: ${auditResult.score}/100`);
    console.log(`  상태: ${auditResult.status}`);
    console.log(`  이슈: ${auditResult.issues?.length || 0}개`);
    auditResult.issues?.forEach((issue: string, i: number) => {
      console.log(`    ${i + 1}. ${issue.substring(0, 100)}...`);
    });

    if (auditResult.detectedHallucinations?.length > 0) {
      console.log(`  감지된 할루시네이션:`);
      auditResult.detectedHallucinations.forEach((h: string) => {
        console.log(`    - ${h}`);
      });
    }

  } catch (e: any) {
    console.error('Audit 실패:', e.message);
  }

  // ========== Step 4: 실효성 분석 ==========
  console.log('\n[Step 4] 실효성 분석');
  console.log('='.repeat(70));

  const auditDetectedIssue = auditResult?.status !== 'PASS';

  console.log('\n┌────────────────────────────────────────────────┐');
  console.log('│              수동 검증 vs Audit 비교           │');
  console.log('├────────────────────────────────────────────────┤');
  console.log(`│ 수동 검증: ${hasHallucinations ? '할루시네이션 있음 ⚠️' : '할루시네이션 없음 ✅'}          │`);
  console.log(`│ Audit 결과: ${auditResult?.status} (${auditResult?.score}점)                │`);
  console.log('├────────────────────────────────────────────────┤');

  if (hasHallucinations && auditDetectedIssue) {
    console.log('│ ✅ 일치: Audit이 문제를 감지함                 │');
    console.log('│    → Audit 실효성 있음                        │');
  } else if (!hasHallucinations && !auditDetectedIssue) {
    console.log('│ ✅ 일치: 둘 다 문제없음                        │');
    console.log('│    → (할루시네이션 없어서 판단 어려움)         │');
  } else if (hasHallucinations && !auditDetectedIssue) {
    console.log('│ ❌ 불일치: 할루시네이션 있는데 Audit 미감지    │');
    console.log('│    → Audit 실효성 없음!                       │');
  } else {
    console.log('│ ⚠️ 불일치: 할루시네이션 없는데 Audit WARNING   │');
    console.log('│    → Audit 너무 엄격 (다른 이유로 WARNING)    │');
  }
  console.log('└────────────────────────────────────────────────┘');

  // 상세 비교
  console.log('\n[상세 비교]');
  if (manual.foundWrong.length > 0) {
    console.log(`수동 발견 부정확 과목: ${manual.foundWrong.join(', ')}`);
    const auditMentions = auditResult?.issues?.some((i: string) =>
      manual.foundWrong.some(w => i.includes(w))
    );
    console.log(`Audit 언급 여부: ${auditMentions ? '✅ 언급함' : '❌ 언급 안함'}`);
  }

  if (manual.unknownProfs.length > 0) {
    const uniqueUnknown = [...new Set(manual.unknownProfs)];
    console.log(`수동 발견 미확인 교수: ${uniqueUnknown.join(', ')}`);
    const auditMentions = auditResult?.issues?.some((i: string) =>
      uniqueUnknown.some(p => i.includes(p))
    );
    console.log(`Audit 언급 여부: ${auditMentions ? '✅ 언급함' : '❌ 언급 안함'}`);
  }

  // 최종 판정
  console.log('\n' + '='.repeat(70));
  console.log('[최종 판정]');
  console.log('='.repeat(70));

  if (!hasHallucinations) {
    console.log('이번 실행에서 할루시네이션이 발생하지 않아 Audit 실효성 판단이 어렵습니다.');
    console.log('→ 프롬프트(V5)가 효과적으로 할루시네이션을 방지하고 있을 수 있습니다.');
  } else if (hasHallucinations && auditDetectedIssue) {
    console.log('✅ Audit 실효성 확인: 실제 파이프라인 데이터의 할루시네이션을 감지했습니다.');
  } else {
    console.log('❌ Audit 실효성 의문: 같은 Gemini가 만든 데이터는 잡지 못할 수 있습니다.');
    console.log('→ Audit 단계 제거 또는 다른 모델 사용 검토 필요');
  }
};

main().catch(console.error);
