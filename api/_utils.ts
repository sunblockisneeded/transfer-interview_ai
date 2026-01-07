import { STREAM_TIMEOUT, API_CALL_DELAY, STREAM_INACTIVITY_TIMEOUT, MODEL_LOW } from './_config.js';

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

export const generateContentWithSmartRetry = async (
    modelInstance: any, // ai.models
    modelName: string,
    prompt: string,
    config: any = {},
    streamTimeout: number = STREAM_TIMEOUT,
    taskName: string = "AI Task" // New parameter for logging
): Promise<any> => {

    const startTime = Date.now();
    console.log(`[${taskName}] 🕒 Queued. (Model: ${modelName})`);

    const attempt = async (currentModel: string, isRetry: boolean): Promise<any> => {
        console.log(`[${taskName}] 🚀 Starting... (Model: ${currentModel}, Retry: ${isRetry})`);

        try {
            // 1. Start Stream (with Initial Connection Timeout)
            const streamingResp = await Promise.race([
                modelInstance.generateContentStream({
                    model: currentModel,
                    contents: prompt,
                    config: config
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("STREAM_TIMEOUT")), streamTimeout))
            ]);

            // 2. Process Stream with Inactivity Timeout
            let fullText = "";
            let collectedChunks: any[] = [];

            const streamIterable = (streamingResp as any).stream || streamingResp;
            const iterator = streamIterable[Symbol.asyncIterator]();

            let nextPromise = iterator.next();

            while (true) {
                // [Modified] Enforce Total Execution Timeout
                if (Date.now() - startTime > streamTimeout) {
                    throw new Error("TOTAL_TIMEOUT_EXCEEDED");
                }
                const timeoutPromise = new Promise<any>((_, reject) => {
                    const id = setTimeout(() => reject(new Error("STREAM_TIMEOUT")), STREAM_INACTIVITY_TIMEOUT);
                    // Attach timer id to promise to clear it later if needed (though we just race)
                    (Promise as any)._timer = id;
                });

                let result;
                try {
                    result = await Promise.race([nextPromise, timeoutPromise]);
                } catch (e) {
                    // If timeout occurred
                    throw e;
                }

                if (result.done) break;

                const chunk = result.value;

                // Process chunk
                let chunkText = "";
                if (typeof chunk.text === 'function') {
                    chunkText = chunk.text();
                } else if (typeof chunk.text === 'string') {
                    chunkText = chunk.text;
                } else if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                    chunkText = chunk.candidates[0].content.parts[0].text;
                }

                fullText += chunkText;
                collectedChunks.push(chunk);

                // Prepare next iteration
                nextPromise = iterator.next();
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`[${taskName}] ✅ Success! (${duration}s)`);

            return {
                text: fullText,
                candidates: [{
                    content: { parts: [{ text: fullText }] },
                    groundingMetadata: collectedChunks.length > 0 ? collectedChunks[collectedChunks.length - 1].groundingMetadata : undefined
                }]
            };

        } catch (error: any) {
            console.error(`[${taskName}] ❌ Failed attempt with ${currentModel}: ${error.message}`);
            throw error;
        }
    };

    // Retry Logic
    try {
        return await attempt(modelName, false);
    } catch (e: any) {
        if (e.message === "STREAM_TIMEOUT" ||
            e.message.includes("503") ||
            e.message.includes("500") ||
            e.message.includes("fetch failed")) {

            console.log(`[${taskName}] ⚠️ Recoverable error. Retrying...`);

            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                return await attempt(modelName, true);
            } catch (e2: any) {
                console.log(`[${taskName}] ⚠️ Retry failed. Switching to Fallback Model (${MODEL_LOW})...`);
                try {
                    const fallback = MODEL_LOW;
                    if (modelName === fallback) throw e2;

                    return await attempt(fallback, true);
                } catch (e3) {
                    console.error(`[${taskName}] ⛔ All attempts failed.`);
                    throw e3;
                }
            }
        }
        throw e;
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

/**
 * 마크다운 테이블을 HTML 테이블로 변환
 */
const convertMarkdownTableToHtml = (text: string): string => {
    // 마크다운 테이블 패턴: | col1 | col2 | 형태의 연속된 줄 (마지막 줄바꿈 선택적)
    const tableRegex = /(\|[^\n]+\|(?:\n|$))+/g;

    return text.replace(tableRegex, (tableMatch) => {
        const lines = tableMatch.trim().split('\n').filter(line => line.trim() && line.includes('|'));
        if (lines.length < 2) return tableMatch; // 최소 헤더 + 구분자

        // 구분자 행 확인 (| :--- | --- | 형태 - 각 셀이 :?-+:? 패턴)
        const separatorIndex = lines.findIndex(line => {
            // 모든 셀이 :?---+:? 형태인지 확인
            const cells = line.split('|').slice(1, -1).map(c => c.trim());
            return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell));
        });
        if (separatorIndex === -1) return tableMatch;

        const headerLines = lines.slice(0, separatorIndex);
        const bodyLines = lines.slice(separatorIndex + 1);

        // 마크다운 bold를 HTML strong으로 변환
        const convertBold = (text: string): string => {
            return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        };

        const parseRow = (line: string): string[] => {
            return line.split('|')
                .slice(1, -1) // 앞뒤 빈 요소 제거
                .map(cell => convertBold(cell.trim()));
        };

        // 헤더 생성
        let html = '<table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:14px;">';
        html += '<thead style="background-color:#f1f5f9;">';
        for (const headerLine of headerLines) {
            html += '<tr>';
            for (const cell of parseRow(headerLine)) {
                html += `<th style="border:1px solid #e2e8f0; padding:10px; text-align:left;">${cell}</th>`;
            }
            html += '</tr>';
        }
        html += '</thead>';

        // 바디 생성
        if (bodyLines.length > 0) {
            html += '<tbody>';
            for (const bodyLine of bodyLines) {
                html += '<tr>';
                for (const cell of parseRow(bodyLine)) {
                    html += `<td style="border:1px solid #e2e8f0; padding:10px;">${cell}</td>`;
                }
                html += '</tr>';
            }
            html += '</tbody>';
        }

        html += '</table>';
        // 테이블을 한 줄로 압축 (프론트엔드에서 줄 단위 처리 시 문제 방지)
        return '\n' + html.replace(/\n/g, '') + '\n';
    });
};

/**
 * 출력 텍스트 정리 (cite 제거, 마크다운→HTML 변환)
 */
export const cleanOutput = (text: string): string => {
    if (!text) return '';

    let result = text
        // [cite: ...] 패턴 제거 (다양한 형식 대응)
        .replace(/\[cite:\s*[\d,\s]+(?:from previous turn)?\]/gi, '')
        .replace(/\[cite:\s*\d+\]/gi, '')
        // 검증 태그 제거 (리포트용)
        .replace(/\s*\[확인됨?\]/g, '')
        .replace(/\s*\[미확인\]/g, '')
        .replace(/\s*\[실제사례\]/g, '')
        .replace(/\s*\[일반\]/g, '');

    // 마크다운 테이블 → HTML 테이블 변환 (프론트엔드에서 렌더링)
    result = convertMarkdownTableToHtml(result);

    // 마크다운 형식은 유지 (프론트엔드 MarkdownContent에서 렌더링)
    // 줄바꿈 정리만 수행
    result = result
        .replace(/\n{4,}/g, '\n\n\n') // 과도한 줄바꿈 정리
        .trim();

    return result;
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
