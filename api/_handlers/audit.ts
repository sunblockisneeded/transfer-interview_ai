import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_FACT_CHECK, timeContext, TIMEOUTS } from '../_config.js';
import { callWithTimeout, parseJsonSafe, sanitizeInput, generateContentWithSmartRetry } from '../_utils.js';

export async function handleAudit(payload: any, res: VercelResponse) {
    const { uni, dept, curriculum, professors, trends, config } = payload;
    const safeUni = sanitizeInput(uni);
    const safeDept = sanitizeInput(dept);

    const model = config?.model || MODEL_FACT_CHECK;
    const timeout = config?.timeout || TIMEOUTS.MACRO_ANALYSIS; // Use macro timeout for audit

    const prompt = `
    당신은 ${safeUni} ${safeDept} 데이터 검증 전문가입니다.
    아래 데이터에 할루시네이션(가상 정보)이 포함되어 있는지 검증하세요.

    [흔한 할루시네이션 패턴 - 주의!]
    ⚠️ 다음은 일반적인 학과 과목이지만 실제 대학에는 없을 수 있습니다:
    - "정치학개론" → 실제는 "정치학원론"일 수 있음
    - "경제학개론" → 실제는 "경제원론"일 수 있음
    - "서양정치사상사" → 실제는 "정치사상 1, 2"일 수 있음
    - "한국정치론", "국제관계학개론" → 존재하지 않을 수 있음

    [검증 방법]
    1. "${safeUni} ${safeDept} 교육과정" 검색
    2. "${safeUni} ${safeDept} 교수" 검색
    3. 데이터에 언급된 과목명/교수명이 실제로 존재하는지 대조

    [Data to Audit]
    1. Curriculum: ${JSON.stringify(curriculum).substring(0, 3000)}
    2. Professors: ${JSON.stringify(professors).substring(0, 3000)}
    3. Trends: ${JSON.stringify(trends).substring(0, 3000)}

    [판정 기준]
    - PASS: 할루시네이션 없음, 정보가 정확함
    - WARNING: 일부 미확인 정보 있으나 심각하지 않음
    - FAIL: 명백한 할루시네이션 발견 (가상 과목명/교수명)

    [출력 형식 - JSON]
    {
      "score": 0-100,
      "status": "PASS" | "WARNING" | "FAIL",
      "hallucinations": ["발견된 가상 정보 목록"],
      "verified": ["검증된 정확한 정보 목록"],
      "issues": ["기타 문제점"],
      "feedback": "전략 생성을 위한 조언"
    }
    `;

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            model,
            prompt,
            { responseMimeType: "application/json" },
            config?.timeout ? config.timeout : undefined,
            "Audit Analysis" // Task Name
        );

        const result = parseJsonSafe(response.text || "{}");

        return res.status(200).json(result);
    } catch (e) {
        console.error("Audit failed", e);
        // Fallback if audit fails - don't block the flow, just warn
        return res.status(200).json({
            score: 0,
            status: "WARNING",
            issues: ["Audit process failed due to timeout or error."],
            feedback: "Proceed with caution."
        });
    }
}
