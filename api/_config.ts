import { GoogleGenAI } from "@google/genai";

// NOTE: We are using process.env.API_KEY here, which is secure on the server.
export const apiKey = process.env.API_KEY;
export const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const MODEL_HIGH = 'gemini-3.0-pro-preview';
export const MODEL_MEDIUM = 'gemini-2.5-pro';
export const MODEL_LOW = 'gemini-2.5-flash';

export const MODEL_DEFAULT = MODEL_LOW;
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
