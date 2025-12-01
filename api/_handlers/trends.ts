import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_RESEARCH, timeContext, currentYear } from '../_config.js';
import { callWithTimeout, extractSources } from '../_utils.js';
import { factCheckAndRefine, reviewContent } from '../_agents.js';

export async function handleTrends(payload: any, res: VercelResponse) {
    const { uni, dept } = payload;
    const prompt = `
    Analyze transfer interview trends for ${dept} at ${uni}.
    Output MUST be in Korean.
    [Temporal Context]
    ${timeContext}
    check whether the informations are correct based on current time. 
    check information could be applied ${currentYear} or ${currentYear + 1}학번.
    
    Structure your response with these EXACT headers:

    # 5. ${dept} 합격 사례 분석 
    - General trends in successful transfer interviews for this major (Any university).
    
    # 6. ${uni} ${dept} 합격 사례 및 꿀팁 
    - Specific tips, hacks, or unique features of this university's interview process.
    - check if it is the ${currentYear} or ${currentYear + 1} school year.
    
    # 7. ${dept} 불합격 사례 및 주의사항
    - use Charlie Munger's Contrary Thinking method.
    - Common reasons for rejection in this field (General).
    
    # 8. ${uni} ${dept} 불합격 요인 분석 
    - Specific pitfalls to avoid for this university/department.
    - Using Charlie Munger's Contrary Thinking approach, analyze how to fail.
    
    # 9. ${dept} 실전 면접 대비 사례
    - Find real-world industry cases or academic case studies relevant to this major.
  `;

    const response = await callWithTimeout(
        ai.models.generateContent({
            model: MODEL_RESEARCH,
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] },
        }),
        180000,
        "Interview Trends Timeout"
    );

    const extracted = extractSources(response);
    const formatted = await reviewContent(extracted.text, "Interview Trends");
    const verified = await factCheckAndRefine(formatted, "Interview Trends", extracted.sources);

    return res.status(200).json({ ...extracted, text: verified });
}
