import { STREAM_TIMEOUT, MODEL_LOW, API_CALL_DELAY, STREAM_INACTIVITY_TIMEOUT } from './_config.js';

// --- Rate Limiting (Simple In-Memory) ---
// Note: In a serverless environment, this state is not shared across instances.
// For production, use Vercel KV or Upstash.
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

export const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    // Clean up old entries
    for (const [key, timestamp] of rateLimitMap.entries()) {
        if (timestamp < windowStart) {
            rateLimitMap.delete(key);
        }
    }

    const requestCount = Array.from(rateLimitMap.entries()).filter(([key, timestamp]) => key.startsWith(ip) && timestamp > windowStart).length;

    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    rateLimitMap.set(`${ip}-${now}`, now);
    return true;
    const sources = chunks
        .filter((chunk: any) => chunk.web?.uri && chunk.web?.title)
        .map((chunk: any) => ({
            title: chunk.web.title,
            uri: chunk.web.uri,
        }));

    const uniqueSources = Array.from(new Map(sources.map((item: any) => [item.uri, item])).values());

    return { text, sources: uniqueSources };
};

export const sanitizeInput = (input: string): string => {
    return input.replace(/[<>"'`]/g, '').substring(0, 100).trim();
};

export const parseJsonSafe = (text: string): any => {
    // 1. Try standard cleanup first
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // 2. If failed, try to extract the first JSON object using brace counting
        const firstOpen = text.indexOf('{');
        if (firstOpen === -1) return {};

        let balance = 0;
        let inString = false;
        let escape = false;

        for (let i = firstOpen; i < text.length; i++) {
            const char = text[i];

            if (escape) {
                escape = false;
                continue;
            }
            if (char === '\\') {
                escape = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === '{') balance++;
                else if (char === '}') {
                    balance--;
                    if (balance === 0) {
                        try {
                            const candidate = text.substring(firstOpen, i + 1);
                            return JSON.parse(candidate);
                        } catch (e2) {
                            // Keep looking if this wasn't it (unlikely)
                        }
                    }
                }
            }
        }
        return {};
    }
};
