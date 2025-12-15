import * as z from "zod";
import { redis } from "./redis";

export type RateLimitConfig = {
	windowMs: number;
	maxRequests: number;
	skipPaths?: string[];
	keyPrefix?: string;
};

/**
 * Global rate limit configuration
 */
const GLOBAL_RATE_LIMIT: RateLimitConfig = {
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 100, // 100 requests per minute
	skipPaths: ["/api/docs", "/api/openapi.json"],
	keyPrefix: "backend:ratelimit",
};

export type RouteContext<TAuth extends boolean = false> = {
	user: TAuth extends true
		? { id: string; email: string; name: string; role?: string }
		: { id: string; email: string; name: string; role?: string } | undefined;
	session?: { id: string };
	isAdmin: boolean;
};

export type MiddlewareContext = RouteContext & {
	request: Request;
	params: Record<string, string>;
	response: ResponseHelper<undefined>;
};

export type MiddlewareHandler = (options: {
	context: MiddlewareContext;
	next: () => Promise<Response>;
}) => Promise<Response> | Response;

type BaseHandlerParams<TSchema extends RouteSchema | undefined, TAuth extends boolean> = {
	request: Request;
	params: Record<string, string>;
	context: RouteContext<TAuth>;
	response: ResponseHelper<TSchema>;
};

type WithBody<T> = T extends undefined ? unknown : { body: T };
type WithQuery<T> = T extends undefined ? unknown : { query: T };

export type RouteHandlerParams<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
	TAuth extends boolean = false,
> = BaseHandlerParams<TSchema, TAuth> & WithBody<TBody> & WithQuery<TQuery>;

export type RouteHandler<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
	TAuth extends boolean = false,
> = (params: RouteHandlerParams<TBody, TQuery, TSchema, TAuth>) => Promise<Response> | Response;

type HandlerFn<TSchema extends RouteSchema | undefined, TAuth extends boolean> = (
	params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>,
) => Promise<Response> | Response;

type ResponseSchema = Record<number | string, z.ZodTypeAny>;

export type RouteSchema = {
	params?: z.ZodTypeAny;
	query?: z.ZodTypeAny;
	body?: z.ZodTypeAny;
	response?: ResponseSchema;
	summary?: string;
	description?: string;
	tags?: string[];
};

export function responseSchema(codes: number[], schema: z.ZodTypeAny): ResponseSchema {
	const result: ResponseSchema = {};
	for (const code of codes) {
		result[code] = schema;
	}
	return result;
}

type InferBodyType<TSchema extends RouteSchema | undefined> = TSchema extends { body: z.ZodTypeAny }
	? z.infer<TSchema["body"]>
	: undefined;

export type InferQueryType<TSchema extends RouteSchema | undefined> = TSchema extends {
	query: z.ZodTypeAny;
}
	? z.infer<TSchema["query"]>
	: undefined;

type InferResponseCode<TSchema extends RouteSchema | undefined, TCode extends number | string> = TSchema extends {
	response: ResponseSchema;
}
	? TSchema["response"][TCode] extends z.ZodTypeAny
		? z.infer<TSchema["response"][TCode]>
		: TSchema["response"][`${TCode}`] extends z.ZodTypeAny
			? z.infer<TSchema["response"][`${TCode}`]>
			: unknown
	: unknown;

export type InferResponseType<TSchema extends RouteSchema | undefined> = InferResponseCode<TSchema, 200>;

type Has201<TSchema extends RouteSchema | undefined> = TSchema extends { response: ResponseSchema }
	? TSchema["response"][201] extends z.ZodTypeAny
		? true
		: TSchema["response"]["201"] extends z.ZodTypeAny
			? true
			: false
	: false;

export type InferSuccessResponseType<TSchema extends RouteSchema | undefined> = Has201<TSchema> extends true
	? InferResponseCode<TSchema, 201>
	: InferResponseCode<TSchema, 200>;

export type InferErrorResponseType<
	TSchema extends RouteSchema | undefined,
	TStatus extends 400 | 401 | 403 | 404 | 500,
> = InferResponseCode<TSchema, TStatus>;

export type ResponseHelper<TSchema extends RouteSchema | undefined> = {
	json: <TStatus extends 200 | 201 = 200>(
		data: TStatus extends 201 ? InferSuccessResponseType<TSchema> : InferResponseType<TSchema>,
		status?: TStatus,
	) => Response;
	error: <TStatus extends 400 | 401 | 403 | 404 | 500 = 400>(
		data: InferErrorResponseType<TSchema, TStatus>,
		status?: TStatus,
	) => Response;
	redirect: (url: string, status?: 301 | 302) => Response;
};

export type Route<TBody = undefined> = {
	method: string;
	path: string;
	handler: RouteHandler<TBody>;
	auth?: boolean;
	rateLimit?: RateLimitConfig | false;
	schema?: RouteSchema;
};

export class Router {
	public routes: Route[] = [];
	public middlewares: MiddlewareHandler[] = [];

	add<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: RouteHandler<TBody, TQuery, TSchema>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: RouteSchema },
	) {
		this.routes.push({
			method: method.toUpperCase(),
			path,
			handler: handler as RouteHandler<TBody>,
			auth: options?.auth,
			rateLimit: options?.rateLimit,
			schema: options?.schema,
		} as Route);
		return this;
	}

	private createResponseHelper<TSchema extends RouteSchema | undefined>(_schema?: TSchema): ResponseHelper<TSchema> {
		return {
			json: <TStatus extends 200 | 201 = 200>(
				data: TStatus extends 201 ? InferSuccessResponseType<TSchema> : InferResponseType<TSchema>,
				status: TStatus = 200 as TStatus,
			): Response => {
				return jsonResponse(data, status);
			},
			error: <TStatus extends 400 | 401 | 403 | 404 | 500 = 400>(
				data: InferErrorResponseType<TSchema, TStatus>,
				status: TStatus = 400 as TStatus,
			): Response => {
				return jsonResponse(data, status);
			},
			redirect: (url: string, status: 301 | 302 = 302): Response => {
				return new Response(null, {
					status,
					headers: { Location: url },
				});
			},
		};
	}

	private wrapHandler<TSchema extends RouteSchema | undefined, TAuth extends boolean>(
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>,
		) => Promise<Response> | Response,
		schema?: TSchema,
		_auth?: boolean,
	): RouteHandler<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth> {
		return (params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, TAuth>) => {
			return handler({
				...params,
				response: this.createResponseHelper(schema),
			});
		};
	}

	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, true>,
		options?: { auth?: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.add(
			method,
			path,
			this.wrapHandler(handler, options?.schema, options?.auth) as RouteHandler<
				InferBodyType<TSchema>,
				InferQueryType<TSchema>,
				TSchema,
				boolean
			>,
			options,
		);
	}

	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("GET", path, handler, options);
	}

	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("POST", path, handler, options);
	}

	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("PUT", path, handler, options);
	}

	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, true>,
		options: { auth: true; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, false>,
		options?: { auth?: false; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: HandlerFn<TSchema, boolean>,
		options?: { auth?: boolean; rateLimit?: RateLimitConfig | false; schema?: TSchema },
	): this {
		return this.registerMethod("DELETE", path, handler, options);
	}

	use(router: Router, prefix?: string): this {
		for (const route of router.routes) {
			const path = prefix ? `${prefix}${route.path}` : route.path;
			this.add(route.method, path, route.handler, {
				auth: route.auth,
				rateLimit: route.rateLimit,
				schema: route.schema,
			});
		}
		// Note: Middlewares are not copied to avoid applying them globally
		// Each router should manage its own middleware scope
		return this;
	}

	middleware(handler: MiddlewareHandler): this {
		this.middlewares.push(handler);
		return this;
	}

	async handle(
		request: Request,
		context: RouteContext,
		jsonResponse: (data: unknown, status?: number) => Response,
	): Promise<Response> {
		const match = this.match(request);
		if (!match) {
			return new Response("Not Found", { status: 404 });
		}

		const { route, params } = match;

		const baseResponseHelper = this.createResponseHelper(undefined);

		const middlewareContext: MiddlewareContext = {
			...context,
			request,
			params,
			response: baseResponseHelper,
		};

		let index = 0;
		const next = async (): Promise<Response> => {
			if (index < this.middlewares.length) {
				const middleware = this.middlewares[index++];
				return await (middleware as MiddlewareHandler)({ context: middlewareContext, next });
			}

			return await this.executeRouteHandler(route, request, params, context, jsonResponse);
		};

		return await next();
	}

	private async executeRouteHandler(
		route: Route,
		request: Request,
		params: Record<string, string>,
		context: RouteContext,
		jsonResponse: (data: unknown, status?: number) => Response,
	): Promise<Response> {
		const rateLimitResult = await this.checkRateLimit(route, request);
		if (rateLimitResult) {
			return rateLimitResult;
		}

		if (route.schema?.params) {
			try {
				const validatedParams = route.schema.params.parse(params);
				Object.assign(params, validatedParams);
			} catch (error) {
				if (error instanceof z.ZodError) {
					return jsonResponse({ error: "Invalid parameters", details: error.issues }, 400);
				}
			}
		}

		let query: unknown;
		if (route.schema?.query) {
			try {
				const queryObj = Object.fromEntries(new URL(request.url).searchParams.entries());
				query = route.schema.query.parse(queryObj);
			} catch (error) {
				if (error instanceof z.ZodError) {
					return jsonResponse({ error: "Invalid query parameters", details: error.issues }, 400);
				}
			}
		}

		const hasBodySchema =
			route.schema?.body && (request.method === "POST" || request.method === "PUT" || request.method === "PATCH");

		let body: unknown;
		if (hasBodySchema && route.schema?.body) {
			try {
				const contentType = request.headers.get("content-type");
				if (!contentType?.includes("application/json")) {
					return jsonResponse(
						{
							error: "Invalid request body",
							details: [
								{
									path: "",
									message: "Content-Type must be application/json",
									code: "custom",
								},
							],
						},
						400,
					);
				}

				let rawBody: unknown;
				try {
					rawBody = await request.json();
				} catch {
					return jsonResponse(
						{
							error: "Invalid request body",
							details: [
								{
									path: "",
									message: "Request body must be valid JSON",
									code: "custom",
								},
							],
						},
						400,
					);
				}

				const parseResult = route.schema.body.safeParse(rawBody);
				if (!parseResult.success) {
					return jsonResponse(
						{
							error: "Invalid request body",
							details: parseResult.error.issues.map((issue) => ({
								path: issue.path.length > 0 ? issue.path.join(".") : "root",
								message: issue.message,
								code: issue.code,
							})),
						},
						400,
					);
				}
				body = parseResult.data;
			} catch (error) {
				if (error instanceof z.ZodError) {
					return jsonResponse(
						{
							error: "Invalid request body",
							details: error.issues.map((issue) => ({
								path: issue.path.length > 0 ? issue.path.join(".") : "root",
								message: issue.message,
								code: issue.code,
							})),
						},
						400,
					);
				}
				return jsonResponse(
					{
						error: "Failed to parse request body",
						message: error instanceof Error ? error.message : "Unknown error",
					},
					400,
				);
			}
		}

		const responseHelper = this.createResponseHelper(route.schema);
		try {
			const hasQuerySchema = !!route.schema?.query;
			if (hasBodySchema) {
				if (route.auth) {
					const handler = route.handler as unknown as RouteHandler<
						unknown,
						unknown,
						typeof route.schema,
						true
					>;
					const handlerParams = {
						request,
						params,
						context: context as unknown as RouteContext<true>,
						body: body,
						response: responseHelper,
						...(hasQuerySchema && { query: query }),
					} as RouteHandlerParams<unknown, unknown, typeof route.schema, true>;
					const response = await handler(handlerParams);
					return response;
				}
				const handler = route.handler as unknown as RouteHandler<unknown, unknown, typeof route.schema, false>;
				const handlerParams = {
					request,
					params,
					context: context as RouteContext<false>,
					body: body,
					response: responseHelper,
					...(hasQuerySchema && { query: query }),
				} as RouteHandlerParams<unknown, unknown, typeof route.schema, false>;
				const response = await handler(handlerParams);
				return response;
			}
			if (route.auth) {
				const handler = route.handler as unknown as RouteHandler<undefined, unknown, typeof route.schema, true>;
				const handlerParams = {
					request,
					params,
					context: context as unknown as RouteContext<true>,
					response: responseHelper,
					...(hasQuerySchema && { query: query }),
				} as RouteHandlerParams<undefined, unknown, typeof route.schema, true>;
				const response = await handler(handlerParams);
				return response;
			}
			const handler = route.handler as unknown as RouteHandler<undefined, unknown, typeof route.schema, false>;
			const handlerParams = {
				request,
				params,
				context: context as unknown as RouteContext<false>,
				response: responseHelper,
				...(hasQuerySchema && { query: query }),
			} as RouteHandlerParams<undefined, unknown, typeof route.schema, false>;
			const response = await handler(handlerParams);
			return response;
		} catch (error) {
			const { formatErrorResponse } = await import("./errors");
			const errorResponse = formatErrorResponse(error);

			let statusCode = 500;
			if (
				error &&
				typeof error === "object" &&
				"statusCode" in error &&
				typeof (error as { statusCode: unknown }).statusCode === "number"
			) {
				statusCode = (error as { statusCode: number }).statusCode;
			}

			return jsonResponse(errorResponse, statusCode);
		}
	}

	private async checkRateLimit(route: Route, request: Request): Promise<Response | null> {
		const url = new URL(request.url);

		let rateLimitConfig: RateLimitConfig | false = GLOBAL_RATE_LIMIT;

		if (route.rateLimit !== undefined) {
			rateLimitConfig = route.rateLimit;
		}

		if (rateLimitConfig === false) {
			return null;
		}

		if (rateLimitConfig.skipPaths?.some((path) => url.pathname.startsWith(path))) {
			return null;
		}
		const clientIP =
			request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			request.headers.get("x-real-ip") ||
			request.headers.get("cf-connecting-ip") ||
			"unknown";

		const key = `${rateLimitConfig.keyPrefix || "backend:ratelimit"}:${clientIP}`;

		try {
			const now = Date.now();
			const windowStart = now - rateLimitConfig.windowMs;

			await redis.zremrangebyscore(key, 0, windowStart);

			const requestCount = await redis.zcard(key);

			if (requestCount >= rateLimitConfig.maxRequests) {
				console.warn(
					`Rate limit exceeded for IP ${clientIP}: ${requestCount}/${rateLimitConfig.maxRequests} requests (${rateLimitConfig.windowMs}ms window)`,
				);
				return new Response(JSON.stringify({ error: "Too many requests" }), {
					status: 429,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Add current request timestamp
			await redis.zadd(key, now, now.toString());

			// Set expiry on the key (cleanup old keys)
			await redis.expire(key, Math.ceil(rateLimitConfig.windowMs / 1000) * 2);

			return null; // No rate limit hit
		} catch (error) {
			console.error("Rate limiting error:", error);
			// Continue with request if Redis fails
			return null;
		}
	}

	match(request: Request): { route: Route; params: Record<string, string> } | null {
		const url = new URL(request.url);
		const pathname = url.pathname;
		const method = request.method.toUpperCase();

		for (const route of this.routes) {
			if (route.method !== method) {
				continue;
			}

			const params = this.matchPath(route.path, pathname);
			if (params !== null) {
				return { route, params };
			}
		}

		return null;
	}

	private matchPath(pattern: string, pathname: string): Record<string, string> | null {
		const patternParts = pattern.split("/").filter(Boolean);
		const pathParts = pathname.split("/").filter(Boolean);

		if (patternParts.length !== pathParts.length) {
			return null;
		}

		const params: Record<string, string> = {};

		for (let i = 0; i < patternParts.length; i++) {
			const patternPart = patternParts[i];
			const pathPart = pathParts[i];

			if (!patternPart || !pathPart) {
				return null;
			}

			if (patternPart.startsWith(":")) {
				const paramName = patternPart.slice(1);
				params[paramName] = decodeURIComponent(pathPart);
			} else if (patternPart !== pathPart) {
				return null;
			}
		}

		return params;
	}
}

export function jsonResponse<T = unknown>(data: T, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export async function parseBody(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return await request.json();
	}
	return null;
}
