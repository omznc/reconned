import { loggingConfig, shouldSampleLog } from "../logging-config";
import { logger } from "../posthog";
import type { MiddlewareContext, MiddlewareHandler } from "../router";

/**
 * Enhanced middleware utilities for more flexible middleware patterns
 */

/**
 * Create conditional middleware that only applies to routes matching a pattern
 */
export function conditionalMiddleware(
	condition: (context: MiddlewareContext) => boolean,
	middleware: MiddlewareHandler,
): MiddlewareHandler {
	return async (options) => {
		if (condition(options.context)) {
			return middleware(options);
		}
		return options.next();
	};
}

/**
 * Create path-based conditional middleware
 */
export function pathMiddleware(
	pattern: string | RegExp | ((pathname: string) => boolean),
	middleware: MiddlewareHandler,
): MiddlewareHandler {
	return conditionalMiddleware((context) => {
		const url = new URL(context.request.url);
		const pathname = url.pathname;

		if (typeof pattern === "string") {
			return pathname.startsWith(pattern);
		}
		if (pattern instanceof RegExp) {
			return pattern.test(pathname);
		}
		return pattern(pathname);
	}, middleware);
}

/**
 * Create method-based conditional middleware
 */
export function methodMiddleware(methods: string | string[], middleware: MiddlewareHandler): MiddlewareHandler {
	const methodSet = new Set(Array.isArray(methods) ? methods : [methods]);

	return conditionalMiddleware((context) => {
		return methodSet.has(context.request.method.toUpperCase());
	}, middleware);
}

/**
 * Create error handling middleware
 */
export function errorHandlingMiddleware(
	errorHandler: (error: unknown, context: MiddlewareContext) => Response | Promise<Response>,
): MiddlewareHandler {
	return async ({ context, next }) => {
		try {
			return await next();
		} catch (error) {
			return await errorHandler(error, context);
		}
	};
}

/**
 * Create response transformation middleware
 */
export function responseTransformMiddleware(
	transform: (response: Response, context: MiddlewareContext) => Response | Promise<Response>,
): MiddlewareHandler {
	return async ({ context, next }) => {
		const response = await next();
		return await transform(response, context);
	};
}

/**
 * Compose multiple middleware handlers into one
 */
export function composeMiddleware(...middlewares: MiddlewareHandler[]): MiddlewareHandler {
	return async (options) => {
		let index = 0;

		const next = async (): Promise<Response> => {
			if (index < middlewares.length) {
				const middleware = middlewares[index++];
				if (!middleware) {
					throw new Error("Middleware is undefined");
				}
				return await middleware({ ...options, next });
			}
			return await options.next();
		};

		return await next();
	};
}

/**
 * Create CORS middleware with configurable options
 */
export function corsMiddleware(
	origins: string[] = ["*"],
	options: {
		allowMethods?: string[];
		allowHeaders?: string[];
		allowCredentials?: boolean;
		maxAge?: number;
	} = {},
): MiddlewareHandler {
	const {
		allowMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowHeaders = ["Content-Type", "Authorization", "X-Requested-With"],
		allowCredentials = true,
		maxAge = 86400,
	} = options;

	return async ({ context, next }) => {
		const { request, response } = context;

		if (request.method === "OPTIONS") {
			const origin = request.headers.get("origin");
			const isAllowedOrigin = origins.includes("*") || (origin && origins.includes(origin));

			if (!isAllowedOrigin) {
				return response.error({ error: "CORS not allowed" }, 403);
			}

			const corsHeaders = new Headers({
				"Access-Control-Allow-Origin": origin || origins[0] || "*",
				"Access-Control-Allow-Methods": allowMethods.join(", "),
				"Access-Control-Allow-Headers": allowHeaders.join(", "),
				"Access-Control-Max-Age": maxAge.toString(),
				...(allowCredentials && { "Access-Control-Allow-Credentials": "true" }),
			});

			const corsResponse = new Response(null, {
				status: 200,
				headers: corsHeaders,
			});

			return corsResponse;
		}

		const actualResponse = await next();

		const origin = request.headers.get("origin");
		const isAllowedOrigin = origins.includes("*") || (origin && origins.includes(origin));

		if (isAllowedOrigin) {
			const newHeaders = new Headers(actualResponse.headers);
			newHeaders.set("Access-Control-Allow-Origin", origin || origins[0] || "*");
			newHeaders.set("Access-Control-Allow-Methods", allowMethods.join(", "));
			newHeaders.set("Access-Control-Allow-Headers", allowHeaders.join(", "));
			if (allowCredentials) {
				newHeaders.set("Access-Control-Allow-Credentials", "true");
			}

			return new Response(actualResponse.body, {
				status: actualResponse.status,
				statusText: actualResponse.statusText,
				headers: newHeaders,
			});
		}

		return actualResponse;
	};
}

/**
 * Create rate limiting middleware
 */
export function rateLimitMiddleware(options: {
	windowMs: number;
	maxRequests: number;
	skipPaths?: string[];
	keyGenerator?: (context: MiddlewareContext) => string;
}): MiddlewareHandler {
	const { windowMs, maxRequests, skipPaths = [], keyGenerator } = options;

	return async ({ context, next }) => {
		const { request } = context;
		const url = new URL(request.url);

		if (skipPaths.some((path) => url.pathname.startsWith(path))) {
			return next();
		}

		const key = keyGenerator
			? keyGenerator(context)
			: `ratelimit:${
					request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
					request.headers.get("x-real-ip") ||
					request.headers.get("cf-connecting-ip") ||
					"unknown"
				}`;

		try {
			const { redis } = await import("../redis");

			const now = Date.now();
			const windowStart = now - windowMs;

			await redis.zremrangebyscore(key, 0, windowStart);

			const requestCount = await redis.zcard(key);

			if (requestCount >= maxRequests) {
				return context.response.error({ error: "Too many requests" }, 429);
			}

			await redis.zadd(key, now, now.toString());

			await redis.expire(key, Math.ceil(windowMs / 1000) * 2);

			return next();
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Rate limiting error",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
				},
			});
			return next();
		}
	};
}

/**
 * Create authentication middleware with role checking
 */
export function authMiddleware(
	options: { requireAuth?: boolean; roles?: string[]; redirectTo?: string } = {},
): MiddlewareHandler {
	const { requireAuth = true, roles = [], redirectTo } = options;

	return async ({ context, next }) => {
		if (requireAuth && !context.user) {
			if (redirectTo) {
				return context.response.redirect(redirectTo);
			}
			return context.response.error({ error: "Authentication required" }, 401);
		}

		if (roles.length > 0 && (!context.user?.role || !roles.includes(context.user.role))) {
			return context.response.error({ error: "Insufficient permissions" }, 403);
		}

		return next();
	};
}

/**
 * Create request logging middleware with configurable levels
 */
export function requestLoggingMiddleware(
	options: {
		logLevel?: "info" | "debug" | "warn" | "error";
		includeHeaders?: boolean;
		includeBody?: boolean;
		excludePaths?: string[];
	} = {},
): MiddlewareHandler {
	const { logLevel = "info", includeHeaders = false, excludePaths = [] } = options;

	return async ({ context, next }) => {
		const { request } = context;
		const url = new URL(request.url);

		if (excludePaths.some((path) => url.pathname.startsWith(path))) {
			return next();
		}

		const shouldLogRequest = loggingConfig.enabled && shouldSampleLog();
		const start = Date.now();
		const timestamp = new Date().toISOString();

		if (shouldLogRequest) {
			logger.emit({
				severityText: logLevel === "error" ? "error" : "info",
				body: `HTTP request: ${request.method} ${url.pathname}`,
				attributes: {
					timestamp,
					method: request.method,
					path: url.pathname,
					user_agent: request.headers.get("user-agent"),
					ip:
						request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
						request.headers.get("x-real-ip") ||
						request.headers.get("cf-connecting-ip") ||
						"unknown",
					request_id: (context as Record<string, unknown>).requestId as string | undefined,
					...(includeHeaders && { headers: Object.fromEntries(request.headers.entries()) }),
				},
			});
		}

		try {
			const response = await next();
			const duration = Date.now() - start;

			if (shouldLogRequest) {
				logger.emit({
					severityText: logLevel === "error" ? "error" : "info",
					body: `HTTP response: ${request.method} ${url.pathname} - ${response.status}`,
					attributes: {
						timestamp: new Date().toISOString(),
						method: request.method,
						path: url.pathname,
						status: response.status,
						duration_ms: duration,
						request_id: (context as Record<string, unknown>).requestId as string | undefined,
					},
				});
			}

			return response;
		} catch (error) {
			const duration = Date.now() - start;

			if (shouldLogRequest) {
				logger.emit({
					severityText: "error",
					body: "Request processing error",
					attributes: {
						method: request.method,
						pathname: url.pathname,
						duration_ms: duration,
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
						request_id: (context as Record<string, unknown>).requestId as string | undefined,
					},
				});
			}

			throw error;
		}
	};
}
