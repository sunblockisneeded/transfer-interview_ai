import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_RESEARCH, timeContext, currentYear, TIMEOUTS } from '../_config.js';
import { callWithTimeout, extractSources, sanitizeInput, generateContentWithSmartRetry, cleanOutput } from '../_utils.js';

export async function handleCurriculum(payload: any, res: VercelResponse) {
    const { uni, dept, config } = payload;
    const safeUni = sanitizeInput(uni);
    const safeDept = sanitizeInput(dept);

    const model = config?.model || MODEL_RESEARCH;
    const timeout = config?.timeout || TIMEOUTS.CURRICULUM;

    // R3 인용강제 프롬프트 (정확성 + 유용성)
    const currentYear = new Date().getFullYear();
    const prompt = `
"${safeUni} ${safeDept} 교육과정"을 검색한 뒤, 편입 면접 준비 가이드를 작성해주세요.

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

    // time limit is 180s
    const response = await generateContentWithSmartRetry(
        ai.models,
        model,
        prompt,
        { tools: [{ googleSearch: {} }] },
        config?.timeout ? config.timeout : undefined,
        "Curriculum Analysis" // Task Name
    );

    const extracted = extractSources(response);
    // 간소화: cleanOutput만 적용 (reviewContent, factCheckAndRefine 제거)
    const cleaned = cleanOutput(extracted.text);

    return res.status(200).json({ ...extracted, text: cleaned });
}
