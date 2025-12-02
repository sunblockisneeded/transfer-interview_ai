import { GoogleGenAI } from "@google/genai";

// NOTE: We are using process.env.API_KEY here, which is secure on the server.
export const apiKey = process.env.API_KEY;
export const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const MODEL_HIGH = 'gemini-3-pro-preview';
export const MODEL_MEDIUM = 'gemini-2.5-pro';
export const MODEL_LOW = 'gemini-2.5-flash';

export const MODEL_DEFAULT = MODEL_LOW;  // 홈페이지에서 이거랑 연결해서 조정할 수 있도록
export const MODEL_RESEARCH = MODEL_DEFAULT;
export const MODEL_SYNTHESIS = MODEL_DEFAULT;
export const MODEL_FACT_CHECK = MODEL_DEFAULT;

// to get current year/ month
const now = new Date();
export const currentYear = now.getFullYear();
export const currentMonth = now.getMonth() + 1;

export const timeContext = `
Your training data is reliable up to 2024. You must treat this as your knowledge cutoff: 
you should not assume you know anything about events, releases, or facts after this date unless they are explicitly provided by tools or system messages. 
for example GPT-4o, Gemini 1.5, and Claude 3.5 are now legacy models, and gpt5, gemini3, etc have been released.
The current time is ${currentYear} - ${currentMonth}.`;

export const DEFAULT_TIMEOUT = 180000; // 3 minutes default
export const STREAM_TIMEOUT = 100000; // 100 seconds for first chunk
export const STREAM_INACTIVITY_TIMEOUT = 20000; // 20 seconds for mid-stream inactivity
export const MAX_RETRIES = 2;
export const API_CALL_DELAY = 2000; // 2 seconds delay before every API call
export const PROFESSOR_ANALYSIS_DELAY = 500; // 500ms delay between professor analysis calls

export const TIMEOUTS = {
    DEFAULT_TIMEOUT: DEFAULT_TIMEOUT,
    PROFESSOR_LIST: DEFAULT_TIMEOUT,
    PROFESSOR_DETAIL: DEFAULT_TIMEOUT,
    CURRICULUM: DEFAULT_TIMEOUT,
    TRENDS: DEFAULT_TIMEOUT,
    MACRO_ANALYSIS: DEFAULT_TIMEOUT,
};
