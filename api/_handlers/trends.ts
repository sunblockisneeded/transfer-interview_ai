import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_RESEARCH, timeContext, currentYear, TIMEOUTS } from '../_config.js';
import { callWithTimeout, extractSources, sanitizeInput, generateContentWithSmartRetry, cleanOutput } from '../_utils.js';

export async function handleTrends(payload: any, res: VercelResponse) {
  const { uni, dept, config } = payload;
  const safeUni = sanitizeInput(uni);
  const safeDept = sanitizeInput(dept);

  const model = config?.model || MODEL_RESEARCH;
  const timeout = config?.timeout || TIMEOUTS.TRENDS;

  // R3 인용강제 프롬프트 (정확성 + 유용성)
  const prompt = `
"${safeUni} ${safeDept} 편입 면접 후기" 또는 "합격 수기"를 검색한 뒤, 실전 가이드를 작성해주세요.

[필수 규칙]
1. 반드시 실제 후기/수기를 검색
2. 검색에서 확인된 정보는 [실제사례] 표시
3. 일반적인 조언은 [일반] 표시

[작성 내용]
### 실제 면접 질문 [실제사례]
- 검색에서 확인된 기출 질문들
- 각 질문에 대한 답변 방향

### 합격자 공통점 [실제사례]
- 후기에서 확인된 합격 요인

### 준비 체크리스트
- D-30: 전공 기초 정리
- D-7: 예상 질문 답변 연습
- D-Day: 주의사항

[목적]
${currentYear}년 편입 면접을 앞둔 학생이 "어떻게 준비해야 하는지" 구체적으로 알 수 있도록 작성
`;

  const response = await generateContentWithSmartRetry(
    ai.models,
    model,
    prompt,
    { tools: [{ googleSearch: {} }] },
    timeout,
    "Interview Trends Analysis" // Task Name
  );

  const extracted = extractSources(response);
  // 간소화: cleanOutput만 적용 (reviewContent, factCheckAndRefine 제거)
  const cleaned = cleanOutput(extracted.text);

  return res.status(200).json({ ...extracted, text: cleaned });
}
