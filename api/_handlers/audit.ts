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
    You are a Senior Admissions Auditor for ${safeUni} ${safeDept}.
    Your job is to strictly audit the gathered research data before it is used for strategy generation.
    
    [Temporal Context]
    ${timeContext}
    This means that anything other than immutable facts like a circle being round should be questioned and fact-checked by official, reliable sources.

    [Data to Audit]
    *참고: 데이터는 길이 제한으로 인해 일부가 잘려 있을 수 있습니다. JSON 문법 오류보다는 '내용의 질'에 집중하십시오.*
    1. Curriculum Analysis: ${JSON.stringify(curriculum).substring(0, 3000)}
    2. Professor Analysis: ${JSON.stringify(professors).substring(0, 3000)}
    3. Trend Analysis: ${JSON.stringify(trends).substring(0, 3000)}

    [Audit Tasks]
    1.**할루시네이션(Hallucination)**: 존재하지 않는 가상의 교수명이나 과목명, 커리큘럼이 포함된 것으로 의심됩니까? 공식 홈페이지의 내용을 통해 검증하십시오.
    2.**전략적 가치**: 이 데이터만으로 차별화된 입시 전략을 짤 수 있을 만큼 충분히 깊이가 있습니까?

    [출력 형식]
    반드시 한국어로 작성된 JSON 객체를 반환하십시오.
    
    JSON 스키마:
    {
      "score": 85, // 0~100 사이의 품질 점수 (숫자)
      "status": "PASS" | "WARNING" | "FAIL", // (문자열)
      "issues": [ // 문제점이 있을 경우 문자열 배열로 나열, 없으면 빈 배열 []
        "구체적인 문제점 1",
        "구체적인 문제점 2"
      ],
      "feedback": "전략 생성 에이전트를 위한 구체적 조언" // 없으면 빈 문자열 ""
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
