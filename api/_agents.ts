import { ai, MODEL_FACT_CHECK, MODEL_RESEARCH, timeContext } from "./_config.js";
import { cleanOutput } from "./_utils.js";

/**
 * Fact-check 및 정제 에이전트 (선택적 사용 - 기본 OFF)
 * @param content 검증할 콘텐츠
 * @param context 콘텐츠 맥락
 * @param sources 참조 소스
 * @param enabled 활성화 여부 (기본값: false)
 */
export const factCheckAndRefine = async (
    content: string,
    context: string,
    sources: any[],
    enabled: boolean = false
): Promise<string> => {
    // 비활성화 시 cleanOutput만 적용하고 반환
    if (!enabled) {
        return cleanOutput(content);
    }

    if (!content || content.length < 50) return cleanOutput(content);

    const sourceContext = sources.map(s => `- ${s.title}: ${s.uri}`).join('\n');
    const prompt = `
    You are a VERY Strict Fact-Checking Agent.
    Your goal is to verify the accuracy of the following text ("Draft Content") which describes ${context}.


    [Temporal Context]
    ${timeContext}
    check whether the informations are correct based on current time.

    [Draft Content]:
    ${content}

    [Reference Sources Used]:
    ${sourceContext}

    Tasks:
    1. Cross-reference specific claims in the Draft Content.
    2. If a specific claim (e.g., "Professor X studies Y") seems hallucinated or contradicts general knowledge for this field, generalize it or remove it.
    3. Ensure the tone is objective and professional Korean.
    4. Maintain the Markdown formatting (Headers, lists).
    5. Output the cleaned, verified content ONLY.
  `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FACT_CHECK,
            contents: prompt,
            config: { systemInstruction: "Output only the verified Markdown text." }
        });
        return cleanOutput(response.text || content);
    } catch (e) {
        console.error("FactCheck failed", e);
        return cleanOutput(content);
    }
};

/**
 * 콘텐츠 리뷰 에이전트 (간소화됨 - cleanOutput만 적용)
 * @deprecated reviewContent는 더 이상 AI 호출하지 않음. cleanOutput으로 대체됨.
 */
export const reviewContent = async (content: string, _context: string): Promise<string> => {
    // 간소화: AI 호출 없이 cleanOutput만 적용
    return cleanOutput(content);
};
