import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load env vars BEFORE importing the handler
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mock Vercel Request/Response for the handler
app.all('/api/gemini', async (req, res) => {
    try {
        // Dynamic import ensures process.env is populated before the module is evaluated
        const { default: handler } = await import('./api/gemini');
        await handler(req as any, res as any);
    } catch (error) {
        console.error('Server Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`
  🚀 Local API Server running at http://localhost:${PORT}
  👉 API Endpoint: http://localhost:${PORT}/api/gemini
  `);
});
