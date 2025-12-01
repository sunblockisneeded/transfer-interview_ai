import { ai, MODEL_FACT_CHECK, MODEL_RESEARCH, timeContext } from "./_config.js";

export const factCheckAndRefine = async (content: string, context: string, sources: any[]): Promise<string> => {
    if (!content || content.length < 50) return content;
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
        return response.text || content;
    } catch (e) {
        console.error("FactCheck failed", e);
        return content;
    }
};

export const reviewContent = async (content: string, context: string): Promise<string> => {
    const prompt = `
    You are a Content Formatting Agent.
    Review the following university admission analysis text (${context}).
    
    1. Fix Markdown formatting (headers on new lines).
    2. Ensure professional Korean (Hangul).
    3. Remove raw HTML tags.
    4. Ensure section numbers match the request.
    
    Content:
    ${content}
  `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_RESEARCH,
            contents: prompt,
            config: { systemInstruction: "Output only the corrected Markdown text." }
        });
        return response.text || content;
    } catch (e) {
        return content;
    }
};
