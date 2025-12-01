import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_RESEARCH, timeContext, TIMEOUTS } from '../_config.js';
import { callWithTimeout, extractSources, parseJsonSafe } from '../_utils.js';
import { factCheckAndRefine } from '../_agents.js';

export async function handleProfessors(payload: any, res: VercelResponse) {
    const { uni, dept } = payload;

    // 1. First, find the list of professors
    const listPrompt = `
    Find the list of professors for ${uni} ${dept}. at least 5 professors.
    Output MUST be in Korean.
    
    [Temporal Context]
    ${timeContext}
    
    Task:
    - Search for the official faculty page or reliable sources for ${uni} ${dept}.
    - Extract the names of the professors.
    - Return a JSON list of names.
    
    Output JSON Structure:
    {
      "names": ["Prof A", "Prof B", ...]
    }
    `;

    let professorNames: string[] = [];
    try {
        const listResponse = await callWithTimeout(
            ai.models.generateContent({
                model: MODEL_RESEARCH,
                contents: listPrompt,
                config: {
                    tools: [{ googleSearch: {} }]
                },
            }),
            TIMEOUTS.PROFESSOR_LIST,
            "Professor List Search Timeout"
        );

        const listJson = parseJsonSafe(listResponse.text || "{}");
        professorNames = listJson.names || [];
    } catch (e) {
        console.error("Failed to get professor list", e);
    }

    // Limit to top 5 to avoid timeouts
    const targetProfessors = professorNames.slice(0, 5);

    // 2. Search details for each professor (Parallel execution)
    const detailPromises = targetProfessors.map(async (name) => {
        const strictPrompt = `
        Research specific details for Professor "${name}" at "${uni} ${dept}".
        **CRITICAL**: Verify this is the person at ${uni} ${dept}, NOT a different person with the same name.
        If you cannot confirm they are at this university, return NULL.
        
        [Temporal Context]
        ${timeContext}

        Task:
        - Find their Lab/Research Area.
        - Find their Email/Contact.
        - Find a list of their recent major papers (2020-2025). If exact titles are not found, find their main research keywords.
        - Analyze their research tendency based on the papers/keywords.
        
        Output Requirements:
        - "researchTendency": **MUST BE IN KOREAN**. Summarize in exactly 3 lines. End with "~하는 경향이 있음".
        - "majorPapers": List actual paper titles if found. If not, list 3-5 main research topics/keywords.
        
        Output JSON Structure:
        {
          "name": "${name}",
          "lab": "Lab Name",
          "contact": "Email",
          "majorPapers": ["Paper 1", "Paper 2", ...],
          "researchTendency": "3-line Korean summary",
          "details": "Other info"
        }
        `;

        const attemptSearch = async (prompt: string, timeout: number) => {
            try {
                const response = await callWithTimeout(
                    ai.models.generateContent({
                        model: MODEL_RESEARCH,
                        contents: prompt,
                        config: {
                            tools: [{ googleSearch: {} }]
                        },
                    }),
                    timeout,
                    `Search Timeout for ${name}`
                );
                let text = response.text || "{}";

                const result = parseJsonSafe(text);
                if (!result || (!result.lab && !result.researchTendency)) return null;
                return result;
            } catch (e) {
                return null;
            }
        };

        let result = await attemptSearch(strictPrompt, TIMEOUTS.PROFESSOR_DETAIL);

        if (!result || !result.lab) {
            const relaxedPrompt = `
                Research details for Professor "${name}" who is likely at "${uni} ${dept}".
                Just find the best available information.
                
                Output Requirements:
                - "researchTendency": **MUST BE IN KOREAN**. Summarize in exactly 3 lines. End with "~하는 경향이 있음".
                
                Output JSON Structure:
                {
                  "name": "${name}",
                  "lab": "Lab Name",
                  "contact": "Email",
                  "majorPapers": ["Paper 1", "Paper 2", ...],
                  "researchTendency": "3-line Korean summary",
                  "details": "Unverified - please check manually"
                }
             `;
            result = await attemptSearch(relaxedPrompt, TIMEOUTS.PROFESSOR_DETAIL);
        }

        return result;
    });

    const results = await Promise.all(detailPromises);
    const validResults = results.filter(r => r !== null);

    // 3. Major Knowledge Analysis (Macro)
    const macroPrompt = `
    Analyze the General Academic Discipline of ${dept}.
    Output MUST be in Korean.
    
    [Temporal Context]
    ${timeContext}
    
    Task:
    - Header MUST be: "# 4. ${dept} 전공 핵심 지식 분석"
    - IMPORTANT: This section must be about the **General Academic Discipline** of ${dept}, NOT specific to ${uni}.
    - What are the universal "Core Ideas" or "Key Concepts" of this field of study?
    - How can a student quickly grasp these core ideas?
    `;

    const macroResponse = await callWithTimeout(
        ai.models.generateContent({
            model: MODEL_RESEARCH,
            contents: macroPrompt,
            config: { tools: [{ googleSearch: {} }] },
        }),
        TIMEOUTS.MACRO_ANALYSIS,
        "Macro Analysis Timeout"
    );

    const macroText = macroResponse.text || "";
    const sources = extractSources(macroResponse).sources;

    const verifiedKnowledge = await factCheckAndRefine(
        macroText,
        `General ${dept} Knowledge`,
        sources
    );

    return res.status(200).json({
        professors: validResults,
        majorKnowledgeAnalysis: verifiedKnowledge,
        sources
    });
}
