import type { VercelResponse } from '@vercel/node';
import { ai, MODEL_RESEARCH, timeContext, currentYear, TIMEOUTS } from '../_config.js';
import { callWithTimeout, extractSources, sanitizeInput, generateContentWithSmartRetry } from '../_utils.js';
import { factCheckAndRefine, reviewContent } from '../_agents.js';

export async function handleTrends(payload: any, res: VercelResponse) {
  const { uni, dept, config } = payload;
  const safeUni = sanitizeInput(uni);
  const safeDept = sanitizeInput(dept);

  const model = config?.model || MODEL_RESEARCH;
  const timeout = config?.timeout || TIMEOUTS.TRENDS;

  const prompt = `
    Analyze transfer interview trends for ${safeDept} at ${safeUni}.
    Output MUST be in Korean.
    무의식적인 자기소개서나 학업계획서에 대한 언급을 피하세요. 자기소개서나 학업계획서가 현재 학년도의 편입 제출 서류에 확실히 포함될때만 언급하세요.
    [Temporal Context]
    ${timeContext}
    check whether the informations are correct based on current time. 
    check information could be applied ${currentYear} or ${currentYear + 1}학번.
    
    Structure your response with these EXACT headers:

    # 5. ${safeDept} 합격 사례 분석 
    - General trends in successful transfer interviews for this major (Any university).
    
    # 6. ${safeUni} ${safeDept} 합격 사례 및 꿀팁 
    - Specific tips, hacks, or unique features of this university's interview process.
    - check if it is the ${currentYear} or ${currentYear + 1} school year.
    
    # 7. ${safeDept} 불합격 사례 및 주의사항 
    - use Charlie Munger's Contrary Thinking method.
    - Common reasons for rejection in this field (General).
    - Analyze how to fail to understand how to succeed.
    
    # 8. ${safeDept} 실전 면접 대비 사례
    - Find real-world industry cases or academic case studies relevant to this major.
  `;

  const response = await generateContentWithSmartRetry(
    ai.models,
    model,
    prompt,
    { tools: [{ googleSearch: {} }] },
    timeout,
    "Interview Trends Analysis" // Task Name
  );

  const extracted = extractSources(response);
  const formatted = await reviewContent(extracted.text, "Interview Trends");
  const verified = await factCheckAndRefine(formatted, "Interview Trends", extracted.sources);

  return res.status(200).json({ ...extracted, text: verified });
}
