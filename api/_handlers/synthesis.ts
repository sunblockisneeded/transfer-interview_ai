import { Type, Schema } from "@google/genai";
import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_SYNTHESIS, MODEL_MEDIUM, MODEL_LOW, currentYear, currentMonth } from '../_config.js';

export async function handleSynthesis(payload: any, res: VercelResponse) {
    const { uni, dept, curriculum, professors, trends } = payload;

    const profSummary = professors.map((p: any) => `${p.name}: ${p.researchTendency}`).join('\n');
    const context = `
    [Curriculum (Core Knowledge)]: ${curriculum.substring(0, 1500)}
    [Interview Trends (Success Cases)]: ${trends.substring(0, 1000)}
  `;

    const prompt = `
    Act as a Top-Tier Transfer Interview Strategic Agent for ${uni} ${dept}.
    Output MUST be in Korean.
    
    Input Data (Summarized):
    ${context}

    You must treat this as your knowledge cutoff.
    The current time is ${currentYear} ${currentMonth}.
    strategy could be applied in ${currentYear}.

    Tasks:
    1. Define "Core Strategy" (종합 면접 준비 전략). 
       - **CRITICAL**: Focus primarily on **Curriculum (Core Knowledge)** and **Successful Interview Cases**.
       - Professor research should only be used as supplementary context, not the main focus.
       - Synthesize a winning strategy based on what students need to KNOW and how they should ANSWER.
       - ${currentYear}년 이나 ${currentYear + 1}학번 기준으로, 편입학 전형을 다시한번 확인하십시오.
       - 편입학에서 면접 전형이 없거나 지필과 서류평가로만 이뤄짐이 확인되면, 편입학에서 면접전형이 없다고 명시하십시오.

    2. List 5 "Core Concepts" (핵심 아이디어/키워드). 
       - **CRITICAL**: The 'keyword' MUST be a short, single phrase (e.g., "Consumer Behavior", "Thermodynamics").
       - **NEVER** include the professor's name or the description in the 'keyword' field.
       - 'description': Explain the concept in depth here.
       - 'example': Provide a concrete real-world application or industry case study.

    3. Generate 9 Anticipated Questions (High/Medium/Low difficulty) based on the data.
       Generate anticipated interview questions. What would a professor want to ask a student in an interview?
       - 'high': High difficulty questions - Questions deeply related to your major subject. 각각의 high difficulty question에 대해 1개의 **꼬리 질문을 추가**하십시오.
       - 'medium': Medium difficulty questions - Questions related to your major subject.
       - 'low': Low difficulty questions - basic knowledge, recall, Why do you want to come to our school's ${dept} department over other schools?

  `;

    const strategySchema: Schema = {
        type: Type.OBJECT,
        properties: {
            coreStrategy: { type: Type.STRING },
            coreConcepts: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        keyword: { type: Type.STRING, description: "Short phrase (max 5 words). NO professor names." },
                        description: { type: Type.STRING, description: "Detailed explanation of the concept." },
                        example: { type: Type.STRING, description: "Real-world application example." },
                    },
                },
            },
            questions: {
                type: Type.OBJECT,
                properties: {
                    high: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                intent: { type: Type.STRING },
                                tip: { type: Type.STRING },
                            },
                        },
                    },
                    medium: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                intent: { type: Type.STRING },
                                tip: { type: Type.STRING },
                            },
                        },
                    },
                    low: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                intent: { type: Type.STRING },
                                tip: { type: Type.STRING },
                            },
                        },
                    },
                },
            },
        },
        required: ["coreStrategy", "coreConcepts", "questions"],
    };

    const attemptSynthesis = async (model: string) => {
        return ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: strategySchema,
            },
        });
    };

    let parsed: any;
    try {
        const response = await attemptSynthesis(MODEL_SYNTHESIS);
        parsed = JSON.parse(response.text || "{}");
    } catch (e) {
        console.warn('Synthesis primary model failed, retrying...', e);
        try {
            const response = await attemptSynthesis(MODEL_MEDIUM);
            parsed = JSON.parse(response.text || "{}");
        } catch (e2) {
            console.warn('Synthesis secondary model failed, retrying...', e2);
            const response = await attemptSynthesis(MODEL_LOW);
            parsed = JSON.parse(response.text || "{}");
        }
    }

    return res.status(200).json({
        coreStrategy: parsed.coreStrategy || "전략을 생성하는 중 오류가 발생했습니다.",
        coreConcepts: Array.isArray(parsed.coreConcepts) ? parsed.coreConcepts : [],
        questions: {
            high: Array.isArray(parsed.questions?.high) ? parsed.questions.high : [],
            medium: Array.isArray(parsed.questions?.medium) ? parsed.questions.medium : [],
            low: Array.isArray(parsed.questions?.low) ? parsed.questions.low : []
        }
    });
}
