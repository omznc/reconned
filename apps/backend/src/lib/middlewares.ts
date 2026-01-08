import type { MiddlewareHandler } from "./router";

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
 * Logging middleware that logs all requests
 */
export const loggingMiddleware: MiddlewareHandler = async ({ context, next }) => {
	const start = Date.now();
	const { request } = context;
	const url = new URL(request.url);

	console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

	try {
		const response = await next();
		const duration = Date.now() - start;
		console.log(
			`[${new Date().toISOString()}] ${request.method} ${url.pathname} - ${response.status} (${duration}ms)`,
		);
		return response;
	} catch (error) {
		const duration = Date.now() - start;
		console.error(
			`[${new Date().toISOString()}] ${request.method} ${url.pathname} - ERROR (${duration}ms):`,
			error,
		);
		throw error;
	}
};

/**
 * Rate limiting is now handled in the Router class for per-route configuration
 * This export is kept for backward compatibility but does nothing
 */
export const rateLimitMiddleware: MiddlewareHandler = async ({ next }) => {
	// Rate limiting is now handled at the router level
	return next();
};

/**
 * Admin authorization middleware
 */
export const adminMiddleware: MiddlewareHandler = async ({ context, next }) => {
	if (!context.isAdmin) {
		return context.response.error({ error: "Unauthorized" }, 401);
	}
	return next();
};
