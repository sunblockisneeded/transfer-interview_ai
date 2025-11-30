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
};

// --- Helper for timeouts ---
export const callWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    let timeoutHandle: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutHandle!);
        return result;
    } catch (error) {
        clearTimeout(timeoutHandle!);
        throw error;
    }
};

export const extractSources = (response: any): { text: string; sources: any[] } => {
    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

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
