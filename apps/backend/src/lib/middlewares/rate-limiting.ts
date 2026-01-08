import type { MiddlewareHandler } from "../router";

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	maxRequests: number; // Max requests per window
	skipPaths?: string[]; // Paths to skip rate limiting
	keyPrefix?: string; // Redis key prefix
}

export interface MiddlewareConfig {
	rateLimit?: RateLimitConfig | false; // false to disable rate limiting
}

/**
 * Rate limiting is now handled in the Router class for per-route configuration
 * This export is kept for backward compatibility but does nothing
 */
export const rateLimitMiddleware: MiddlewareHandler = async ({ next }) => {
	// Rate limiting is now handled at the router level
	return next();
};
