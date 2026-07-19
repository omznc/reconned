import { randomUUIDv7 } from "bun";
import * as z from "zod";
import { formatErrorResponse } from "./errors";
import { InMemoryRateLimitStore } from "./rate-limit-store";
import type {
	CacheStore,
	InferBodyType,
	InferQueryType,
	MiddlewareContext,
	MiddlewareHandler,
	RateLimitConfig,
	ResponseHelper,
	Route,
	RouteCacheConfig,
	RouteContext,
	RouteHandler,
	RouteHandlerParams,
	RouterOptions,
	RouteSchema,
} from "./types";

export type {
	CacheStore,
	InferBodyType,
	InferQueryType,
	MiddlewareContext,
	MiddlewareHandler,
	RateLimitConfig,
	ResponseHelper,
	Route,
	RouteCacheConfig,
	RouteContext,
	RouteHandler,
	RouteHandlerParams,
	RouterOptions,
	RouteSchema,
};

/**
 * Helper function to create a response schema for multiple status codes
 */
export function responseSchema(codes: number[], schema: z.ZodTypeAny): Record<number, z.ZodTypeAny> {
	const result: Record<number, z.ZodTypeAny> = {};
	for (const code of codes) {
		result[code] = schema;
	}
	return result;
}

/**
 * Main Router class
 */
/**
 * A route with its path pre-split at registration time so that matching never
 * has to allocate per candidate.
 */
type CompiledRoute = {
	route: Route;
	/** Path split on "/" with empty segments removed. */
	segments: string[];
	/** Per-segment param name, or null for literal segments. */
	paramNames: (string | null)[];
	/** Number of `:param` segments. */
	paramCount: number;
};

function splitPath(path: string): string[] {
	const parts = path.split("/");
	const out: string[] = [];
	for (const part of parts) {
		if (part) {
			out.push(part);
		}
	}
	return out;
}

/**
 * Signature used for collision detection: param *names* are erased, because
 * `/clubs/:id` and `/clubs/:clubId` match exactly the same URLs — the second
 * registration is unreachable dead code just the same.
 */
function matchSignature(method: string, segments: string[]): string {
	let sig = `${method} /`;
	for (const segment of segments) {
		sig += `${segment.charCodeAt(0) === 58 ? ":" : segment}/`;
	}
	return sig;
}

type StaleEnvelope = { __swr: 1; f: number; d: unknown };

function isStaleEnvelope(value: unknown): value is StaleEnvelope {
	return typeof value === "object" && value !== null && (value as { __swr?: unknown }).__swr === 1;
}

/**
 * Sets headers on a Response in place. Some Responses (e.g. redirects, or those
 * returned by `fetch`) have immutable headers — those get rebuilt instead.
 */
export function setHeaders(response: Response, entries: Array<[string, string]>): Response {
	try {
		for (const [name, value] of entries) {
			response.headers.set(name, value);
		}
		return response;
	} catch {
		const headers = new Headers(response.headers);
		for (const [name, value] of entries) {
			headers.set(name, value);
		}
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}

function rebuildResponse(result: { status: number; statusText?: string; headers: Headers; body: string }): Response {
	const bodyAllowed = result.status !== 204 && result.status !== 205 && result.status !== 304;
	return new Response(bodyAllowed ? result.body : null, {
		status: result.status,
		statusText: result.statusText,
		headers: new Headers(result.headers),
	});
}

/** Extracts the pathname from an absolute URL without constructing a `URL`. */
function pathnameOf(url: string): string {
	const schemeEnd = url.indexOf("://");
	const start = schemeEnd === -1 ? 0 : url.indexOf("/", schemeEnd + 3);
	if (start === -1) {
		return "/";
	}
	let end = url.length;
	for (let i = start; i < url.length; i++) {
		const code = url.charCodeAt(i);
		if (code === 63 || code === 35) {
			end = i;
			break;
		}
	}
	return url.slice(start, end);
}

/** Matches pre-split request segments against a pre-split route pattern. */
function matchSegments(candidate: CompiledRoute, pathParts: string[]): Record<string, string> | null {
	const { segments, paramNames } = candidate;
	if (segments.length !== pathParts.length) {
		return null;
	}

	let params: Record<string, string> | null = null;
	for (let i = 0; i < segments.length; i++) {
		const paramName = paramNames[i];
		const pathPart = pathParts[i] as string;

		if (paramName !== null && paramName !== undefined) {
			if (params === null) {
				params = {};
			}
			params[paramName] = decodeURIComponent(pathPart);
		} else if (segments[i] !== pathPart) {
			return null;
		}
	}

	return params ?? {};
}

export class Router {
	public routes: Route[] = [];
	public middlewares: MiddlewareHandler[] = [];
	private defaultRateLimit?: RateLimitConfig | false;
	private globalRateLimitStore = new InMemoryRateLimitStore();
	private cacheStore?: CacheStore;
	private cacheKeyPrefix: string;
	private defaultSwr: number | undefined;
	private onDuplicateRoute: "throw" | "error" | "ignore";
	private onMissingVaryByUser: "throw" | "warn";

	/** Exact-path lookup for routes with no params: `METHOD a/b/c` -> route. */
	private staticRoutes = new Map<string, CompiledRoute>();
	/** Parameterized routes bucketed by method, pre-sorted by ascending param count. */
	private dynamicRoutes = new Map<string, CompiledRoute[]>();
	/** Registration signatures, for duplicate detection. */
	private routeSignatures = new Map<string, string>();
	/** Number of routes reflected in the index, so direct `routes` mutation is still handled. */
	private indexedCount = 0;
	/** In-process single-flight map for cacheable GETs (stampede protection). */
	private inflight = new Map<string, Promise<{ status: number; headers: Headers; body: string }>>();

	constructor(options?: RouterOptions) {
		this.defaultRateLimit = options?.defaultRateLimit;
		this.cacheStore = options?.cache?.store;
		this.cacheKeyPrefix = options?.cache?.keyPrefix ?? "route:";
		this.defaultSwr = options?.cache?.defaultSwr;
		this.onDuplicateRoute = options?.onDuplicateRoute ?? "error";
		this.onMissingVaryByUser = options?.onMissingVaryByUser ?? "throw";
	}

	add<TBody = undefined, TQuery = undefined, TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: RouteHandler<TBody, TQuery, TSchema>,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: RouteSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	) {
		const route = {
			method: method.toUpperCase(),
			path,
			handler: handler as RouteHandler<TBody>,
			auth: options?.auth,
			rateLimit: options?.rateLimit,
			schema: options?.schema,
			cache: options?.cache,
			bustCache: options?.bustCache,
		} as Route;

		this.assertSafeCacheConfig(route);
		this.routes.push(route);
		this.indexRoute(route);
		this.indexedCount = this.routes.length;
		return this;
	}

	/**
	 * Guards against accidental cross-user cache leaks.
	 *
	 * `varyByUser` defaults to `false` (one shared entry per key). That default is
	 * only safe for responses that are identical for every caller, so an
	 * authenticated route that caches without saying which it is, is rejected here
	 * rather than silently shared.
	 */
	private assertSafeCacheConfig(route: Route): void {
		if (!route.cache || !route.auth || route.cache.varyByUser !== undefined) {
			return;
		}

		const message =
			`[router] ${route.method} ${route.path} has \`auth: true\` and \`cache\` but no explicit ` +
			"`cache.varyByUser`. The default is `false`, which shares ONE cached response across ALL " +
			"users. Set `varyByUser: true` for per-user data, or `varyByUser: false` to confirm the " +
			"response is identical for every user.";

		if (this.onMissingVaryByUser === "throw") {
			throw new Error(message);
		}
		console.warn(message);
	}

	private indexRoute(route: Route): void {
		const segments = splitPath(route.path);
		const paramNames: (string | null)[] = [];
		let paramCount = 0;
		for (const segment of segments) {
			if (segment.charCodeAt(0) === 58) {
				paramCount++;
				paramNames.push(segment.slice(1));
			} else {
				paramNames.push(null);
			}
		}

		const signature = matchSignature(route.method, segments);
		const existing = this.routeSignatures.get(signature);
		if (existing !== undefined) {
			const message =
				`[router] Duplicate route registration: ${route.method} ${route.path} collides with ` +
				`${route.method} ${existing}. Only the first registration is reachable; the later ` +
				"handler is dead code.";
			if (this.onDuplicateRoute === "throw") {
				throw new Error(message);
			}
			if (this.onDuplicateRoute === "error") {
				console.error(message);
			}
			// The first registration keeps winning, matching previous behaviour.
			return;
		}
		this.routeSignatures.set(signature, route.path);

		const compiled: CompiledRoute = { route, segments, paramNames, paramCount };

		if (paramCount === 0) {
			this.staticRoutes.set(`${route.method} ${segments.join("/")}`, compiled);
			return;
		}

		const bucket = this.dynamicRoutes.get(route.method);
		if (!bucket) {
			this.dynamicRoutes.set(route.method, [compiled]);
			return;
		}
		// Insert keeping ascending param count, stable within equal counts, so the
		// first match found is the same route the old linear "fewest params wins"
		// scan would have picked.
		let i = bucket.length;
		while (i > 0 && (bucket[i - 1] as CompiledRoute).paramCount > paramCount) {
			i--;
		}
		bucket.splice(i, 0, compiled);
	}

	/** Rebuilds the index if `routes` was mutated directly (public field). */
	private syncIndex(): void {
		if (this.indexedCount === this.routes.length) {
			return;
		}
		this.staticRoutes.clear();
		this.dynamicRoutes.clear();
		this.routeSignatures.clear();
		const previous = this.onDuplicateRoute;
		this.onDuplicateRoute = "ignore";
		for (const route of this.routes) {
			this.indexRoute(route);
		}
		this.onDuplicateRoute = previous;
		this.indexedCount = this.routes.length;
	}

	private createResponseHelper<TSchema extends RouteSchema | undefined>(
		schema?: TSchema,
		_routePath?: string,
	): ResponseHelper<TSchema> {
		return {
			json: <TStatus extends 200 | 201 = 200>(data: unknown, status: TStatus = 200 as TStatus): Response => {
				let responseData: unknown = data;

				if (schema?.response) {
					const statusSchema = schema.response[status] || schema.response[`${status}`];
					if (statusSchema) {
						responseData = statusSchema.parse(data);
					}
				}

				return jsonResponse(responseData, status);
			},
			error: <TStatus extends 400 | 401 | 403 | 404 | 429 | 500 = 400>(
				data: unknown,
				status: TStatus = 400 as TStatus,
			): Response => {
				let responseData: unknown = data;
				if (schema?.response) {
					const statusSchema = schema.response[status] || schema.response[`${status}`];
					if (statusSchema) {
						responseData = statusSchema.parse(data);
					}
				}
				return jsonResponse(responseData, status);
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
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options?: {
			auth?: true;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: {
			auth?: false;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	private registerMethod<TSchema extends RouteSchema | undefined = undefined>(
		method: string,
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
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
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: {
			auth: true;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: {
			auth?: false;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	get<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this {
		return this.registerMethod("GET", path, handler, options);
	}

	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: {
			auth: true;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: {
			auth?: false;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	post<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this {
		return this.registerMethod("POST", path, handler, options);
	}

	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: {
			auth: true;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: {
			auth?: false;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	put<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this {
		return this.registerMethod("PUT", path, handler, options);
	}

	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: {
			auth: true;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: {
			auth?: false;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	delete<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this {
		return this.registerMethod("DELETE", path, handler, options);
	}

	patch<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, true>,
		) => Promise<Response> | Response,
		options: {
			auth: true;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	patch<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, false>,
		) => Promise<Response> | Response,
		options?: {
			auth?: false;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this;
	patch<TSchema extends RouteSchema | undefined = undefined>(
		path: string,
		handler: (
			params: RouteHandlerParams<InferBodyType<TSchema>, InferQueryType<TSchema>, TSchema, boolean>,
		) => Promise<Response> | Response,
		options?: {
			auth?: boolean;
			rateLimit?: RateLimitConfig | false;
			schema?: TSchema;
			cache?: RouteCacheConfig;
			bustCache?: string[];
		},
	): this {
		return this.registerMethod("PATCH", path, handler, options);
	}

	use(router: Router, prefix?: string): this {
		for (const route of router.routes) {
			const path = prefix ? `${prefix}${route.path}` : route.path;
			this.add(route.method, path, route.handler, {
				auth: route.auth,
				rateLimit: route.rateLimit,
				schema: route.schema,
				cache: route.cache,
				bustCache: route.bustCache,
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
		jsonResponseFn: (data: unknown, status?: number) => Response,
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

			return await this.executeRouteHandler(route, request, params, context, jsonResponseFn);
		};

		return await next();
	}

	private async executeRouteHandler(
		route: Route,
		request: Request,
		params: Record<string, string>,
		context: RouteContext,
		jsonResponseFn: (data: unknown, status?: number) => Response,
	): Promise<Response> {
		if (route.auth && !context.user) {
			return jsonResponseFn({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
		}

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
					return jsonResponseFn({ error: "Invalid parameters", details: error.issues }, 400);
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
					return jsonResponseFn({ error: "Invalid query parameters", details: error.issues }, 400);
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
					return jsonResponseFn(
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
					return jsonResponseFn(
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
					return jsonResponseFn(
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
					return jsonResponseFn(
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
				return jsonResponseFn(
					{
						error: "Failed to parse request body",
						message: error instanceof Error ? error.message : "Unknown error",
					},
					400,
				);
			}
		}

		const responseHelper = this.createResponseHelper(route.schema, route.path);

		const routeCache = route.cache;
		const cacheable = request.method === "GET" && !!routeCache && !!this.cacheStore;
		const swr = routeCache ? (routeCache.swr ?? this.defaultSwr ?? routeCache.ttl * 10) : 0;
		const cacheKey = cacheable ? this.buildCacheKey(route, params, request, context) : "";

		// Cache check: serve from cache on GET hit
		if (cacheable) {
			const cached = await this.readCache(cacheKey);
			if (cached) {
				const ttl = routeCache?.ttl ?? 0;
				if (!cached.stale) {
					return this.addCacheControlHeaders(jsonResponseFn(cached.data, 200), ttl, swr);
				}
				// Opt-in serve-stale: answer immediately, refresh in the background.
				this.revalidateInBackground(cacheKey, route, swr, () =>
					this.invokeHandler(route, request, params, context, responseHelper, body, query, hasBodySchema),
				);
				const stale = this.addCacheControlHeaders(jsonResponseFn(cached.data, 200), ttl, swr);
				setHeaders(stale, [["X-Cache", "STALE"]]);
				return stale;
			}
		}

		try {
			let handlerResponse: Response;

			if (cacheable) {
				// Single-flight: concurrent misses on the same key run the handler once.
				handlerResponse = await this.computeWithSingleFlight(cacheKey, route, swr, () =>
					this.invokeHandler(route, request, params, context, responseHelper, body, query, hasBodySchema),
				);
			} else {
				handlerResponse = await this.invokeHandler(
					route,
					request,
					params,
					context,
					responseHelper,
					body,
					query,
					hasBodySchema,
				);
			}

			// Post-processing: cache busting for mutation routes
			if (handlerResponse.status < 400 && route.bustCache && route.bustCache.length > 0 && this.cacheStore) {
				for (const bustKey of route.bustCache) {
					try {
						const resolved = this.resolveBustKey(bustKey, params);
						const pattern = `${this.cacheKeyPrefix}${resolved}:*`;
						await this.cacheStore.delByPattern(pattern);
					} catch {
						// Cache bust failure is non-fatal
					}
				}
			}

			// Add Cache-Control headers for GET routes with cache config
			if (request.method === "GET" && route.cache) {
				return this.addCacheControlHeaders(handlerResponse, route.cache.ttl, swr);
			}

			return handlerResponse;
		} catch (error) {
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

			return jsonResponseFn(errorResponse, statusCode);
		}
	}

	/** Invokes the route handler with the right parameter shape. */
	private async invokeHandler(
		route: Route,
		request: Request,
		params: Record<string, string>,
		context: RouteContext,
		responseHelper: ResponseHelper<RouteSchema | undefined>,
		body: unknown,
		query: unknown,
		hasBodySchema: boolean | undefined,
	): Promise<Response> {
		const hasQuerySchema = !!route.schema?.query;
		{
			let handlerResponse: Response;

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
					handlerResponse = await handler(handlerParams);
				} else {
					const handler = route.handler as unknown as RouteHandler<
						unknown,
						unknown,
						typeof route.schema,
						false
					>;
					const handlerParams = {
						request,
						params,
						context: context as unknown as RouteContext<false>,
						body: body,
						response: responseHelper,
						...(hasQuerySchema && { query: query }),
					} as RouteHandlerParams<unknown, unknown, typeof route.schema, false>;
					handlerResponse = await handler(handlerParams);
				}
			} else if (route.auth) {
				const handler = route.handler as unknown as RouteHandler<undefined, unknown, typeof route.schema, true>;
				const handlerParams = {
					request,
					params,
					context: context as unknown as RouteContext<true>,
					response: responseHelper,
					...(hasQuerySchema && { query: query }),
				} as RouteHandlerParams<undefined, unknown, typeof route.schema, true>;
				handlerResponse = await handler(handlerParams);
			} else {
				const handler = route.handler as unknown as RouteHandler<
					undefined,
					unknown,
					typeof route.schema,
					false
				>;
				const handlerParams = {
					request,
					params,
					context: context as unknown as RouteContext<false>,
					response: responseHelper,
					...(hasQuerySchema && { query: query }),
				} as RouteHandlerParams<undefined, unknown, typeof route.schema, false>;
				handlerResponse = await handler(handlerParams);
			}

			return handlerResponse;
		}
	}

	/**
	 * Runs `compute` at most once per in-flight cache key, and writes the result
	 * to the cache without blocking the response.
	 */
	private async computeWithSingleFlight(
		cacheKey: string,
		route: Route,
		swr: number,
		compute: () => Promise<Response>,
	): Promise<Response> {
		const existing = this.inflight.get(cacheKey);
		if (existing) {
			return rebuildResponse(await existing);
		}

		const pending = (async () => {
			const response = await compute();
			// Reading the body as text avoids the old clone -> json -> stringify round trip.
			const bodyText = await response.text();
			return {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
				body: bodyText,
			};
		})();

		this.inflight.set(cacheKey, pending);
		try {
			const result = await pending;
			if (result.status < 400) {
				this.writeCache(cacheKey, route, swr, result.body, result.headers);
			}
			return rebuildResponse(result);
		} finally {
			this.inflight.delete(cacheKey);
		}
	}

	/** Reads a cache entry, unwrapping the serve-stale envelope when present. */
	private async readCache(cacheKey: string): Promise<{ data: unknown; stale: boolean } | null> {
		try {
			const cached = await this.cacheStore?.get(cacheKey);
			if (cached === null || cached === undefined) {
				return null;
			}
			const parsed = JSON.parse(cached);
			if (isStaleEnvelope(parsed)) {
				return { data: parsed.d, stale: Date.now() > parsed.f };
			}
			return { data: parsed, stale: false };
		} catch {
			// Cache read failure is non-fatal; fall through to the handler
			return null;
		}
	}

	/** Fire-and-forget cache write. Failures are logged, never swallowed silently. */
	private writeCache(cacheKey: string, route: Route, swr: number, bodyText: string, headers: Headers): void {
		if (!this.cacheStore || !route.cache) {
			return;
		}
		const contentType = headers.get("content-type");
		if (contentType && !contentType.includes("application/json")) {
			return;
		}

		let payload = bodyText;
		if (route.cache.serveStale) {
			try {
				payload = JSON.stringify({ __swr: 1, f: Date.now() + route.cache.ttl * 1000, d: JSON.parse(bodyText) });
			} catch (error) {
				console.error(`[router] cache write skipped for ${cacheKey}: body is not JSON`, error);
				return;
			}
		}

		void this.cacheStore.set(cacheKey, payload, { ttl: route.cache.ttl + swr })?.catch?.((error: unknown) => {
			console.error(`[router] cache write failed for ${cacheKey}:`, error);
		});
	}

	/** Refreshes a stale entry in the background (serve-stale-while-revalidate). */
	private revalidateInBackground(
		cacheKey: string,
		route: Route,
		swr: number,
		compute: () => Promise<Response>,
	): void {
		if (this.inflight.has(cacheKey)) {
			return;
		}

		// `inflight` is per-process, so it only deduplicates within one replica. If the store can
		// hold a shared lock, take it first so a stale key popular enough to be requested on every
		// replica at once still results in exactly one origin recomputation.
		//
		// Losing the race is not an error: the caller has already been handed the stale response,
		// and whichever replica won will refresh the entry for everyone.
		const acquireLock = this.cacheStore?.acquireLock;
		if (acquireLock && this.cacheStore) {
			const store = this.cacheStore;
			// The lock outlives the revalidation it guards (ttl + swr), otherwise it could expire
			// mid-flight and let a second replica start a duplicate recomputation anyway.
			const lockTtl = Math.max(1, Math.ceil(route.cache ? route.cache.ttl + swr : swr));
			void acquireLock
				.call(store, `${cacheKey}:revalidating`, lockTtl)
				.then((won) => {
					if (!won) {
						return;
					}
					return this.computeWithSingleFlight(cacheKey, route, swr, compute).then(() => undefined);
				})
				.catch((error: unknown) => {
					console.error(`[router] background revalidation failed for ${cacheKey}:`, error);
				});
			return;
		}

		void this.computeWithSingleFlight(cacheKey, route, swr, compute).catch((error: unknown) => {
			console.error(`[router] background revalidation failed for ${cacheKey}:`, error);
		});
	}

	private async checkRateLimit(route: Route, request: Request): Promise<Response | null> {
		const url = new URL(request.url);

		let rateLimitConfig: RateLimitConfig | false | undefined = route.rateLimit;

		// If route doesn't specify, use default
		if (rateLimitConfig === undefined) {
			rateLimitConfig = this.defaultRateLimit;
		}

		if (rateLimitConfig === false) {
			return null;
		}

		if (rateLimitConfig?.skipPaths?.some((path) => url.pathname.startsWith(path))) {
			return null;
		}

		// If no rate limit configured, no rate limiting
		if (!rateLimitConfig) {
			return null;
		}

		const key = rateLimitConfig.keyGenerator
			? rateLimitConfig.keyGenerator(request)
			: `${rateLimitConfig.keyPrefix || "ratelimit"}:${
					request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
					request.headers.get("x-real-ip") ||
					request.headers.get("cf-connecting-ip") ||
					"unknown"
				}`;

		const store = rateLimitConfig.store || this.globalRateLimitStore;

		try {
			const now = Date.now();
			const windowStart = now - rateLimitConfig.windowMs;

			await store.zremrangebyscore(key, 0, windowStart);
			const requestCount = await store.zcard(key);

			if (requestCount >= rateLimitConfig.maxRequests) {
				return new Response(JSON.stringify({ error: "Too many requests" }), {
					status: 429,
					headers: { "Content-Type": "application/json" },
				});
			}

			// These two are independent — issue them together instead of sequentially.
			await Promise.all([
				store.zadd(key, now, `${now}:${randomUUIDv7()}`),
				store.expire(key, Math.ceil(rateLimitConfig.windowMs / 1000) * 2),
			]);

			return null; // No rate limit hit
		} catch {
			// On error, allow the request through
			return null;
		}
	}

	private buildCacheKey(
		route: Route,
		params: Record<string, string>,
		request: Request,
		context?: RouteContext,
	): string {
		const segments: string[] = [];

		const cache = route.cache;
		if (!cache) {
			throw new Error("buildCacheKey called for a route without cache config");
		}

		// Start with resolved key template
		let key = cache.key;
		for (const [param, value] of Object.entries(params)) {
			key = key.replace(`{${param}}`, value);
		}
		segments.push(key);

		// Append user context only when explicitly requested. The default is `false`:
		// see `assertSafeCacheConfig` for the guard that keeps this safe.
		const varyByUser = cache.varyByUser ?? false;
		if (varyByUser) {
			const userId = context?.user?.id || "anon";
			segments.push(`u=${userId}`);
		}

		// Append sorted varyByQuery params
		if (cache.varyByQuery && cache.varyByQuery.length > 0) {
			const url = new URL(request.url);
			const qpSegments: string[] = [];
			for (const qp of [...cache.varyByQuery].sort()) {
				const val = url.searchParams.get(qp);
				if (val !== null) {
					qpSegments.push(`${qp}=${val}`);
				}
			}
			if (qpSegments.length > 0) {
				segments.push(qpSegments.join(":"));
			}
		}

		// Ensure cache key always ends with a `:` segment terminator
		// so that delByPattern("prefix:{bustKey}:*") always matches.
		segments.push("");

		return `${this.cacheKeyPrefix}${segments.join(":")}`;
	}

	private resolveBustKey(bustKey: string, params: Record<string, string>): string {
		let resolved = bustKey;
		for (const [key, value] of Object.entries(params)) {
			resolved = resolved.replace(`{${key}}`, value);
		}
		return resolved;
	}

	private addCacheControlHeaders(response: Response, maxAge: number, swr: number): Response {
		return setHeaders(response, [["Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=${swr}`]]);
	}

	match(request: Request): { route: Route; params: Record<string, string> } | null {
		this.syncIndex();

		const method = request.method.toUpperCase();
		// Avoid `new URL()` (it parses the whole URL) — we only need the path.
		const pathname = pathnameOf(request.url);
		// One split per request instead of one per candidate route.
		const pathParts = splitPath(pathname);

		const staticMatch = this.staticRoutes.get(`${method} ${pathParts.join("/")}`);
		if (staticMatch) {
			return { route: staticMatch.route, params: {} };
		}

		const bucket = this.dynamicRoutes.get(method);
		if (!bucket) {
			return null;
		}

		// Bucket is sorted by ascending param count, so the first match is the
		// fewest-params match — same winner as the old full scan, with early exit.
		for (const candidate of bucket) {
			const params = matchSegments(candidate, pathParts);
			if (params !== null) {
				return { route: candidate.route, params };
			}
		}

		return null;
	}
}

/**
 * Create a JSON response
 */
export function jsonResponse<T = unknown>(data: T, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

/**
 * Parse request body as JSON
 */
export async function parseBody(request: Request): Promise<unknown> {
	const contentType = request.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return await request.json();
	}
	return null;
}
