/**
 * Rate Limiter for Client-Side API Call Protection
 * 
 * Prevents abuse by limiting the number of requests within a time window.
 */

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

class RateLimiter {
    private requests: number[] = [];

    constructor(private config: RateLimitConfig) { }

    /**
     * Check if the current request is allowed
     * @returns true if allowed, false if rate limit exceeded
     */
    check(): boolean {
        const now = Date.now();

        // Remove requests outside the time window
        this.requests = this.requests.filter(
            timestamp => now - timestamp < this.config.windowMs
        );

        // Check if limit is exceeded
        if (this.requests.length >= this.config.maxRequests) {
            return false;
        }

        // Record this request
        this.requests.push(now);
        return true;
    }

    /**
     * Get remaining time until next request is allowed
     * @returns milliseconds until next request, or 0 if allowed now
     */
    getRetryAfter(): number {
        if (this.requests.length < this.config.maxRequests) {
            return 0;
        }

        const oldestRequest = this.requests[0];
        const timeUntilExpiry = this.config.windowMs - (Date.now() - oldestRequest);
        return Math.max(0, timeUntilExpiry);
    }

    /**
     * Reset the rate limiter
     */
    reset(): void {
        this.requests = [];
    }
}

// Export a pre-configured rate limiter for analysis requests
export const analysisRateLimiter = new RateLimiter({
    maxRequests: 3,
    windowMs: 60000 // 1 minute
});
