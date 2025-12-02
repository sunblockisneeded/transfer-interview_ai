import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_RESEARCH, timeContext, TIMEOUTS, PROFESSOR_ANALYSIS_DELAY } from '../_config.js';
import { callWithTimeout, extractSources, parseJsonSafe, sanitizeInput, generateContentWithSmartRetry } from '../_utils.js';
import { factCheckAndRefine } from '../_agents.js';

export async function handleProfessors(payload: any, res: VercelResponse) {
    const { uni, dept, config } = payload;
    const safeUni = sanitizeInput(uni);
    const safeDept = sanitizeInput(dept);

    const model = config?.model || MODEL_RESEARCH;
    const listTimeout = config?.timeout || TIMEOUTS.PROFESSOR_LIST;
    const detailTimeout = config?.timeout || TIMEOUTS.PROFESSOR_DETAIL;
    const macroTimeout = config?.timeout || TIMEOUTS.MACRO_ANALYSIS;

    // 1. First, find the list of professors
    const listPrompt = `
    Find the list of professors for ${safeUni} ${safeDept}. at least 5 professors.
    Output MUST be in Korean.
    
    [Temporal Context]
    ${timeContext}

    Return ONLY a JSON object with this structure:
    {
      "names": ["Name1", "Name2", "Name3", ...]
    }
  `;

    let professorNames: string[] = [];
    try {
        const listResponse = await generateContentWithSmartRetry(
            ai.models,
            model,
            listPrompt,
            { tools: [{ googleSearch: {} }] },
            config?.timeout ? config.timeout : undefined,
            "Professor List Analysis" // Task Name
        );

        const listJson = parseJsonSafe(listResponse.text || "{}");
        professorNames = listJson.names || [];
    } catch (e) {
        console.error("Failed to get professor list", e);
        // Fallback: try to proceed or return empty
    }

    if (professorNames.length === 0) {
        return res.status(200).json({
            professors: [],
            majorKnowledgeAnalysis: "교수진 정보를 찾을 수 없습니다.",
            sources: []
        });
    }

    // 2. Analyze each professor (Sequential with Delay)
    // Limit to 5 to avoid timeouts
    const targetProfessors = professorNames.slice(0, 5);
    // Use configured delay or default
    const delayMs = config?.delay || PROFESSOR_ANALYSIS_DELAY || 500;

    const professorDetails = await Promise.all(
        targetProfessors.map(async (name, index) => {
            // Stagger start times
            if (index > 0) {
                await new Promise(resolve => setTimeout(resolve, index * delayMs));
            }
            return await attemptSearch(name, safeUni, safeDept, model, detailTimeout, config);
        })
    );

    const validProfessors = professorDetails.filter(p => p !== null);

    // 3. Synthesize Major Knowledge Analysis
    // ... (rest of the function)
    const knowledgePrompt = `
        Based on the following professor research areas, summarize the core academic focus of ${safeUni} ${safeDept}.
        Output MUST be in Korean.
        
        Professors:
        ${validProfessors.map(p => `- ${p.name}: ${p.researchTendency} (${p.majorPapers?.join(', ')})`).join('\n')}
        
        Structure:
        # ${safeDept} 주요 연구 분야
        - Identify 3-4 main research clusters.
        - Explain the academic strengths of this department.
    `;

    let majorKnowledgeAnalysis = "";
    try {
        const knowledgeResponse = await generateContentWithSmartRetry(
            ai.models,
            model,
            knowledgePrompt,
            {},
            config?.timeout ? config.timeout : undefined,
            "Major Knowledge Analysis" // Task Name
        );
        majorKnowledgeAnalysis = knowledgeResponse.text || "";
    } catch (e) {
        majorKnowledgeAnalysis = "주요 연구 분야 분석에 실패했습니다.";
    }

    return res.status(200).json({
        professors: validProfessors,
        majorKnowledgeAnalysis,
        sources: [] // Sources are hard to aggregate perfectly here, but could be added
    });
}

async function attemptSearch(name: string, uni: string, dept: string, model: string, timeout: number, config: any) {
    const prompt = `
        Analyze professor "${name}" from ${uni} ${dept}.
        Output MUST be in Korean.
        
        [Temporal Context]
        ${timeContext}

        Return ONLY a JSON object:
        {
          "name": "${name}",
          "lab": "Lab Name (or 'Unknown')",
          "contact": "Email or Office (or 'Unknown')",
          "researchTendency": "One sentence summary of research focus (ends with ~하는 경향이 있음)",
          "majorPapers": ["Paper 1", "Paper 2", "Paper 3"],
          "details": "Brief description of their academic background or specific interests"
        }
    `;

    try {
        const response = await generateContentWithSmartRetry(
            ai.models,
            model,
            prompt,
            { tools: [{ googleSearch: {} }] },
            config?.timeout ? config.timeout : undefined,
            `Professor Detail: ${name}` // Task Name
        );
        let text = response.text || "{}";

        const result = parseJsonSafe(text);
        if (!result || (!result.lab && !result.researchTendency)) return null;
        return result;
    } catch (e) {
        return null;
    }
}
