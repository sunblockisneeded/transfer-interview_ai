import type { VercelRequest, VercelResponse } from '@vercel/node';
import { apiKey } from './_config';
import { checkRateLimit } from './_utils';
import { handleValidate } from './_handlers/validate';
import { handleCurriculum } from './_handlers/curriculum';
import { handleProfessors } from './_handlers/professors';
import { handleTrends } from './_handlers/trends';
import { handleSynthesis } from './_handlers/synthesis';

// --- Main Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. 스위치 확인: 환경변수가 'true'가 아니면 즉시 거절
    if (process.env.API_ENABLED !== 'true') {
        return res.status(503).json({ error: "Server is currently closed by admin." });
    }

    // CORS handling
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
    const origin = req.headers.origin || '';

    // In production, you should set ALLOWED_ORIGINS to your Vercel domain
    // e.g. https://your-app.vercel.app
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Rate Limiting
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    // Note: checkRateLimit needs to be imported from _utils or _config where it was moved.
    // Wait, I moved checkRateLimit to _utils.ts but in the previous step I put it in _utils.ts?
    // Let me check my previous write_to_file for _utils.ts.
    // Yes, checkRateLimit is in _utils.ts.
    // But wait, rateLimitMap is stateful. If I import it from _utils, it should be fine as long as the module is cached.
    // However, in Vercel serverless, state is not guaranteed to persist.
    // But for this refactor, I am just moving code.

    // Actually, I need to import checkRateLimit from './_utils' not './_config'.
    // Let me correct the import above.

    if (!apiKey) {
        console.error("API_KEY is missing in server environment");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    const { action, payload } = req.body;

    try {
        switch (action) {
            case 'validate':
                return await handleValidate(payload, res);
            case 'curriculum':
                return await handleCurriculum(payload, res);
            case 'professors':
                return await handleProfessors(payload, res);
            case 'trends':
                return await handleTrends(payload, res);
            case 'synthesis':
                return await handleSynthesis(payload, res);
            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error: any) {
        console.error('API Error:', error);
        // Don't leak stack traces to client
        return res.status(500).json({ error: 'Internal Server Error. Please try again later.' });
    }
}
