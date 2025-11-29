/**
 * Logging Utility for Production Safety
 * 
 * In production, console.log/error can leak sensitive information.
 * This utility ensures logs are only shown in development.
 */

const isDev = import.meta.env.DEV ?? true; // Default to true for safety


export const logger = {
    log: (context: string, ...args: any[]) => {
        if (isDev) {
            console.log(`[${context}]`, ...args);
        }
    },

    error: (context: string, error: any) => {
        if (isDev) {
            console.error(`[${context}]`, error);
        } else {
            // In production, only log generic message
            console.error(`[${context}] An error occurred`);
            // TODO: Send to external monitoring service (e.g., Sentry)
        }
    },

    warn: (context: string, ...args: any[]) => {
        if (isDev) {
            console.warn(`[${context}]`, ...args);
        }
    }
};
