import { Type, Schema } from "@google/genai";
import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_SYNTHESIS, MODEL_MEDIUM, MODEL_LOW, currentYear, currentMonth } from '../_config.js';
import { callWithTimeout, generateContentWithSmartRetry } from '../_utils.js';

export async function handleSynthesis(payload: any, res: VercelResponse) {
    const { uni, dept, curriculum, professors, trends, config } = payload;

    const model = config?.model || MODEL_SYNTHESIS;

    const profSummary = professors.map((p: any) => `${p.name}: ${p.researchTendency}`).join('\n');
    const context = `
    json형식이 짤려 제공될 수 있습니다. substring으로 제공했기 때문입니다. 
    [Curriculum (Core Knowledge)]: ${curriculum.substring(0, 2000)}
    [Interview Trends (Success Cases)]: ${trends.substring(0, 1000)} 
  `;

    const strategyPrompt = `
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
       - 무의식적인 자기소개서나 학업계획서에 대한 언급을 피하세요. 자기소개서나 학업계획서가 현재 학년도의 편입 제출 서류에 확실히 포함될때만 언급하세요.

    2. List 5 "Core Concepts" (핵심 아이디어/키워드). 
       - **CRITICAL**: The 'keyword' MUST be a short, single phrase (e.g., "Consumer Behavior", "Thermodynamics").
       - Create keywords based on basic major knowledge.
       - **NEVER** include the professor's name or the description in the 'keyword' field.
       - 'description': Explain the concept in depth here.
       - 'example': Provide a concrete real-world application or industry case study.
    `;

    const questionsPrompt = `
    Act as a Top-Tier Transfer Interview Question Generator for ${uni} ${dept}.
    Output MUST be in Korean.
    
    Input Data (Summarized):
    ${context}

    Tasks:
    3. Generate 9 + 3(high 꼬리질문) Anticipated Questions based on the data. (Generate 3 questions for each difficulty level) What would a professor want to ask a student in an transfer interview?
       - **CRITICAL**: You MUST generate exactly 3 questions for EACH difficulty level.
       - 'high': High difficulty questions - Questions: deeply related to your major subject. OR Real-world case questions related to major. (너무 과하지 않은 수준의, 그리고 1~2학년 수업 과목 위주일 것.) 각각의 high difficulty question에 대해 1개의 **꼬리 질문을 추가**하십시오.
       - 'medium': Medium difficulty questions - Questions related to your major subject.
       - 'low': Low difficulty questions - basic knowledge, recall, Why do you want to come to our school's ${dept} department over other schools? **MUST generate 3 questions.**
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
        },
        required: ["coreStrategy", "coreConcepts"],
    };

    const questionsSchema: Schema = {
        type: Type.OBJECT,
        properties: {
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
        required: ["questions"],
    };

    const attemptStrategy = async () => {
        return generateContentWithSmartRetry(
            ai.models,
            model,
            strategyPrompt,
            {
                responseMimeType: "application/json",
                responseSchema: strategySchema,
            },
            config?.timeout ? config.timeout : undefined,
            "Final Synthesis - Strategy" // Task Name
        );
    };

    const attemptQuestions = async () => {
        return generateContentWithSmartRetry(
            ai.models,
            model,
            questionsPrompt,
            {
                responseMimeType: "application/json",
                responseSchema: questionsSchema,
            },
            config?.timeout ? config.timeout : undefined,
            "Final Synthesis - Questions" // Task Name
        );
    };

    const subTask = payload.subTask || 'all'; // 'strategy', 'questions', or 'all'

    let strategyData: any = {};
    let questionsData: any = {};

    try {
        if (subTask === 'strategy') {
            const strategyResp = await attemptStrategy();
            strategyData = JSON.parse(strategyResp.text || "{}");
            return res.status(200).json(strategyData);
        }

        if (subTask === 'questions') {
            const questionsResp = await attemptQuestions();
            questionsData = JSON.parse(questionsResp.text || "{}");
            return res.status(200).json(questionsData);
        }

        // Default 'all' behavior (Parallel)
        const [strategyResp, questionsResp] = await Promise.all([
            attemptStrategy(),
            attemptQuestions()
        ]);

        strategyData = JSON.parse(strategyResp.text || "{}");
        questionsData = JSON.parse(questionsResp.text || "{}");

    } catch (e) {
        console.error('Synthesis failed after smart retries', e);
    }

    return res.status(200).json({
        coreStrategy: strategyData.coreStrategy || "전략을 생성하는 중 오류가 발생했습니다.",
        coreConcepts: Array.isArray(strategyData.coreConcepts) ? strategyData.coreConcepts : [],
        questions: {
            high: Array.isArray(questionsData.questions?.high) ? questionsData.questions.high : [],
            medium: Array.isArray(questionsData.questions?.medium) ? questionsData.questions.medium : [],
            low: Array.isArray(questionsData.questions?.low) ? questionsData.questions.low : []
        }
    });
}
