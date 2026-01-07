/**
 * 최종 파이프라인 테스트
 *
 * 목적: R3(인용강제) + A2(구체적패턴) 조합이 실제로 작동하는지 확인
 * 평가: 정확성 + 유용성
 *
 * 실행: API_KEY=xxx npx tsx test/final-pipeline-test.ts
 */

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = 'gemini-3-flash-preview';

const UNI = "충남대학교";
const DEPT = "정치외교학과";
const currentYear = new Date().getFullYear();

// Ground Truth
const CORRECT_COURSES = ["정치학원론", "비교정치경제", "북한정치론", "시민사회정치론",
  "환경및자원안보", "정치사상 2", "국제기구정치론", "중국정치론",
  "국제안보", "소수자정치", "국제관계이론", "동남아정치론",
  "선거와정당정치", "정치사상 1", "정치학방법론", "비교정치론"];

const WRONG_COURSES = ["정치학개론", "국제관계학개론", "서양정치사상사",
  "한국정치론", "정치사상사", "국제정치학개론"];

const CORRECT_PROFS = ["오영달", "김지운", "고봉준", "박영득", "기여운", "김정현", "박수인"];

// ========== 업데이트된 프롬프트 (R3 인용강제) ==========

const curriculumPrompt = `
"${UNI} ${DEPT} 교육과정"을 검색한 뒤, 편입 면접 준비 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 학과 홈페이지를 검색하여 실제 과목명 확인
2. 과목명 옆에 [확인됨] 표시
3. 검색에서 확인 안 된 정보는 [미확인] 표시

[작성 내용]
### 핵심 전공 과목
| 과목명 | 핵심 개념 | 면접 예상 질문 |
|--------|----------|---------------|
| (검색된 과목명) [확인됨] | 이 과목에서 배우는 핵심 이론 | 면접에서 나올 수 있는 질문 |

### 학과 특색
- 이 학과만의 강점 분야
- 타 대학 대비 차별점

### 면접 준비 핵심
- 반드시 알아야 할 개념 3-5개
- 각 개념의 정의와 적용 사례

[목적]
${currentYear}년 편입 면접을 준비하는 학생이 "무엇을 공부해야 하는지" 명확히 알 수 있도록 작성
`;

const professorsPrompt = `
"${UNI} ${DEPT} 교수" 또는 학과 홈페이지를 검색한 뒤, 교수진 분석 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 검색하여 실제 교수명 확인
2. 교수명 옆에 [확인됨] 표시
3. 검색에서 확인 안 된 정보는 [미확인] 표시

[작성 내용]
### 교수진 현황
| 교수명 [확인됨] | 전공 분야 | 면접 연결 포인트 |
|----------------|----------|-----------------|
| (검색된 교수명) | 연구 분야 | 이 교수 앞에서 나올 수 있는 질문 |

### 학과 강점 분야
- 교수진 구성에서 보이는 학과의 특화 분야
- 면접에서 어필할 수 있는 포인트

[목적]
편입 면접 시 "이 학과에 왜 오고 싶은지" 설득력 있게 답변할 수 있도록 정보 제공
`;

// ========== 업데이트된 Audit 프롬프트 (A2 구체적패턴) ==========

const createAuditPrompt = (curriculum: string, professors: string) => `
당신은 ${UNI} ${DEPT} 데이터 검증 전문가입니다.
아래 데이터에 할루시네이션(가상 정보)이 포함되어 있는지 검증하세요.

[흔한 할루시네이션 패턴 - 주의!]
⚠️ 다음은 일반적인 학과 과목이지만 실제 대학에는 없을 수 있습니다:
- "정치학개론" → 실제는 "정치학원론"일 수 있음
- "서양정치사상사" → 실제는 "정치사상 1, 2"일 수 있음
- "한국정치론", "국제관계학개론" → 존재하지 않을 수 있음

[검증 방법]
1. "${UNI} ${DEPT} 교육과정" 검색
2. "${UNI} ${DEPT} 교수" 검색
3. 데이터에 언급된 과목명/교수명이 실제로 존재하는지 대조

[Data to Audit]
1. Curriculum: ${curriculum.substring(0, 3000)}
2. Professors: ${professors.substring(0, 3000)}

[판정 기준]
- PASS: 할루시네이션 없음
- WARNING: 일부 미확인 정보
- FAIL: 명백한 할루시네이션 발견

[출력 형식 - JSON]
{
  "score": 0-100,
  "status": "PASS" | "WARNING" | "FAIL",
  "hallucinations": ["발견된 가상 정보"],
  "verified": ["검증된 정확한 정보"],
  "feedback": "조언"
}
`;

// ========== 검증 함수 ==========

const verify = (text: string) => {
  const correct = CORRECT_COURSES.filter(c => text.includes(c));
  const wrong = WRONG_COURSES.filter(c => text.includes(c));
  const profs = CORRECT_PROFS.filter(p => text.includes(p));
  const hasConfirmTag = text.includes('[확인됨]') || text.includes('[확인]');
  return { correct, wrong, profs, hasConfirmTag };
};

// 유용성 체크
const checkUsefulness = (text: string) => {
  const checks = {
    hasTable: text.includes('|') && text.includes('---'),
    hasConcepts: /핵심|개념|이론/.test(text),
    hasQuestions: /질문|답변/.test(text),
    hasStrategy: /준비|전략|어필/.test(text),
    length: text.length
  };
  const score = Object.values(checks).filter(v => v === true || (typeof v === 'number' && v > 500)).length;
  return { ...checks, score };
};

// ========== 메인 ==========

const main = async () => {
  console.log('='.repeat(70));
  console.log('최종 파이프라인 테스트 (R3 + A2)');
  console.log('='.repeat(70));

  if (!apiKey) {
    console.error('API_KEY 필요');
    process.exit(1);
  }

  // 1. Research 단계 (병렬)
  console.log('\n[1] Research 단계');
  console.log('-'.repeat(50));

  const startResearch = Date.now();
  const [currResp, profResp] = await Promise.all([
    ai.models.generateContent({
      model: MODEL,
      contents: curriculumPrompt,
      config: { tools: [{ googleSearch: {} }] }
    }),
    ai.models.generateContent({
      model: MODEL,
      contents: professorsPrompt,
      config: { tools: [{ googleSearch: {} }] }
    })
  ]);

  const currText = currResp.text || '';
  const profText = profResp.text || '';
  const researchTime = ((Date.now() - startResearch) / 1000).toFixed(1);

  console.log(`  완료: ${researchTime}초`);

  // 2. 정확성 검증
  console.log('\n[2] 정확성 검증 (Ground Truth 비교)');
  console.log('-'.repeat(50));

  const allText = currText + profText;
  const v = verify(allText);

  console.log(`  ✅ 정확한 과목: ${v.correct.length}개`);
  if (v.correct.length > 0) console.log(`     → ${v.correct.join(', ')}`);
  console.log(`  ❌ 부정확 과목: ${v.wrong.length}개`);
  if (v.wrong.length > 0) console.log(`     → ${v.wrong.join(', ')}`);
  console.log(`  👨‍🏫 정확한 교수: ${v.profs.length}명`);
  if (v.profs.length > 0) console.log(`     → ${v.profs.join(', ')}`);
  console.log(`  🏷️ [확인됨] 태그: ${v.hasConfirmTag ? '사용함 ✅' : '미사용'}`);

  // 3. 유용성 검증
  console.log('\n[3] 유용성 검증');
  console.log('-'.repeat(50));

  const useful = checkUsefulness(allText);
  console.log(`  📊 표 형식: ${useful.hasTable ? '✅' : '❌'}`);
  console.log(`  📚 핵심 개념: ${useful.hasConcepts ? '✅' : '❌'}`);
  console.log(`  ❓ 예상 질문: ${useful.hasQuestions ? '✅' : '❌'}`);
  console.log(`  🎯 준비 전략: ${useful.hasStrategy ? '✅' : '❌'}`);
  console.log(`  📏 분량: ${useful.length}자`);
  console.log(`  → 유용성 점수: ${useful.score}/5`);

  // 4. Audit 단계
  console.log('\n[4] Audit 단계');
  console.log('-'.repeat(50));

  const startAudit = Date.now();
  const auditResp = await ai.models.generateContent({
    model: MODEL,
    contents: createAuditPrompt(currText, profText),
    config: {
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    }
  });

  const auditTime = ((Date.now() - startAudit) / 1000).toFixed(1);
  let audit: any;
  try {
    audit = JSON.parse(auditResp.text || '{}');
  } catch {
    audit = { score: 0, status: 'ERROR' };
  }

  console.log(`  완료: ${auditTime}초`);
  console.log(`  점수: ${audit.score}/100`);
  console.log(`  상태: ${audit.status}`);

  if (audit.hallucinations?.length > 0) {
    console.log(`  🔍 감지된 할루시네이션:`);
    audit.hallucinations.forEach((h: string) => console.log(`     - ${h}`));
  }

  if (audit.verified?.length > 0) {
    console.log(`  ✓ 검증된 정보: ${audit.verified.slice(0, 5).join(', ')}...`);
  }

  // 5. 종합 평가
  console.log('\n' + '='.repeat(70));
  console.log('종합 평가');
  console.log('='.repeat(70));

  const accuracyScore = Math.max(0, 100 - v.wrong.length * 20 + v.correct.length * 3);
  const usefulnessScore = useful.score * 20;
  const auditAccuracy = (v.wrong.length > 0 && audit.status !== 'PASS') ? 20 : 0;
  const totalScore = Math.min(100, (accuracyScore + usefulnessScore + auditAccuracy) / 2.2);

  console.log(`\n┌${'─'.repeat(48)}┐`);
  console.log(`│ 정확성: ${String(accuracyScore).padStart(3)}/100 (부정확 ${v.wrong.length}개, 정확 ${v.correct.length}개)`.padEnd(49) + '│');
  console.log(`│ 유용성: ${String(usefulnessScore).padStart(3)}/100 (${useful.score}/5 항목 충족)`.padEnd(49) + '│');
  console.log(`│ Audit 정합성: ${audit.status} (실제 오류 ${v.wrong.length}개)`.padEnd(49) + '│');
  console.log(`├${'─'.repeat(48)}┤`);
  console.log(`│ 종합 점수: ${totalScore.toFixed(0)}/100`.padEnd(49) + '│');
  console.log(`└${'─'.repeat(48)}┘`);

  // 결과 판정
  console.log('\n[판정]');
  if (v.wrong.length === 0 && useful.score >= 4) {
    console.log('✅ 성공: 정확하고 유용한 가이드 생성');
  } else if (v.wrong.length <= 1 && useful.score >= 3) {
    console.log('⚠️ 양호: 약간의 개선 필요');
  } else {
    console.log('❌ 개선 필요: 정확성 또는 유용성 부족');
  }

  // 샘플 출력
  console.log('\n' + '='.repeat(70));
  console.log('Curriculum 응답 샘플 (500자)');
  console.log('='.repeat(70));
  console.log(currText.substring(0, 500) + '...');

  console.log('\n' + '='.repeat(70));
  console.log('Professors 응답 샘플 (500자)');
  console.log('='.repeat(70));
  console.log(profText.substring(0, 500) + '...');
};

main().catch(console.error);
