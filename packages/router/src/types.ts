import type * as z from "zod";

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Storage interface for rate limiting.
 * Implement this to use different backends (Redis, in-memory, etc.)
 */
export interface RateLimitStore {
	/**
	 * Remove entries older than the given timestamp
	 */
	zremrangebyscore(key: string, min: number, max: number): Promise<void>;

	/**
	 * Get the number of entries in the sorted set
	 */
	zcard(key: string): Promise<number>;

	/**
	 * Add an entry to the sorted set
	 */
	zadd(key: string, score: number, member: string): Promise<void>;

	/**
	 * Set expiration on a key
	 */
	expire(key: string, seconds: number): Promise<void>;
}

/**
 * Rate limit configuration
 */
export type RateLimitConfig = {
	windowMs: number;
	maxRequests: number;
	skipPaths?: string[];
	keyPrefix?: string;
	/** Custom storage backend. If not provided, uses in-memory storage */
	store?: RateLimitStore;
	/** Custom key generator. Defaults to IP-based key */
	keyGenerator?: (request: Request) => string;
};

// ============================================================================
// Route Context
// ============================================================================

/**
 * Context passed to route handlers and middleware
 */
export type RouteContext<TAuth extends boolean = false> = {
	user: TAuth extends true
		? { id: string; email: string; name: string; role?: string }
		: { id: string; email: string; name: string; role?: string } | undefined;
	session?: { id: string };
	isAdmin: boolean;
	requestId: string;
	requestStartTime: number;
	businessContext?: Record<string, unknown>;
};

/**
 * Extended context for middleware handlers
 */
export type MiddlewareContext = RouteContext & {
	request: Request;
	params: Record<string, string>;
	response: ResponseHelper<undefined>;
};

// ============================================================================
// Middleware
// ============================================================================

/**
 * Middleware handler function
 */
export type MiddlewareHandler = (options: {
	context: MiddlewareContext;
	next: () => Promise<Response>;
}) => Promise<Response> | Response;

// ============================================================================
// Route Schema
// ============================================================================

export type ResponseSchema = Record<number | string, z.ZodTypeAny>;

export type McpToolConfig =
	| boolean
	| {
			name?: string;
			description?: string;
	  };

/**
 * Schema definition for a route
 */
export type RouteSchema = {
	params?: z.ZodTypeAny;
	query?: z.ZodTypeAny;
	body?: z.ZodTypeAny;
	response?: ResponseSchema;
	summary?: string;
	description?: string;
	tags?: string[];
	mcpTool?: McpToolConfig;
};

// ============================================================================
// Route Handler Types
// ============================================================================

type BaseHandlerParams<TSchema extends RouteSchema | undefined, TAuth extends boolean> = {
	request: Request;
	params: Record<string, string>;
	context: RouteContext<TAuth>;
	response: ResponseHelper<TSchema>;
};

type WithBody<T> = T extends undefined ? unknown : { body: T };
type WithQuery<T> = T extends undefined ? unknown : { query: T };

/**
 * Parameters passed to route handlers
 */
export type RouteHandlerParams<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
	TAuth extends boolean = false,
> = BaseHandlerParams<TSchema, TAuth> & WithBody<TBody> & WithQuery<TQuery>;

/**
 * Route handler function
 */
export type RouteHandler<
	TBody = undefined,
	TQuery = undefined,
	TSchema extends RouteSchema | undefined = undefined,
	TAuth extends boolean = false,
> = (params: RouteHandlerParams<TBody, TQuery, TSchema, TAuth>) => Promise<Response> | Response;

// ============================================================================
// Response Helper
// ============================================================================

export type InferBodyType<TSchema extends RouteSchema | undefined> = TSchema extends { body: z.ZodTypeAny }
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

export type InferSuccessResponseType<TSchema extends RouteSchema | undefined> =
	Has201<TSchema> extends true ? InferResponseCode<TSchema, 201> : InferResponseCode<TSchema, 200>;

export type InferErrorResponseType<
	TSchema extends RouteSchema | undefined,
	TStatus extends 400 | 401 | 403 | 404 | 429 | 500,
> = InferResponseCode<TSchema, TStatus>;

/**
 * Response helper for creating JSON responses with type safety
 */
export type ResponseHelper<TSchema extends RouteSchema | undefined> = {
	json: <TStatus extends 200 | 201 = 200>(
		data: TStatus extends 201 ? InferSuccessResponseType<TSchema> : InferResponseType<TSchema>,
		status?: TStatus,
	) => Response;
	error: <TStatus extends 400 | 401 | 403 | 404 | 429 | 500 = 400>(
		data: InferErrorResponseType<TSchema, TStatus>,
		status?: TStatus,
	) => Response;
	redirect: (url: string, status?: 301 | 302) => Response;
};

// ============================================================================
// Route Definition
// ============================================================================

/**
 * Route definition
 */
export type Route<TBody = undefined> = {
	method: string;
	path: string;
	handler: RouteHandler<TBody>;
	auth?: boolean;
	rateLimit?: RateLimitConfig | false;
	schema?: RouteSchema;
	cache?: RouteCacheConfig;
	bustCache?: string[];
};

// ============================================================================
// Caching
// ============================================================================

/**
 * Storage interface for response caching.
 * Implement this to use different backends (Redis, in-memory, etc.)
 */
export interface CacheStore {
	/** Get a cached value by key */
	get(key: string): Promise<string | null>;

	/** Set a cached value with optional TTL */
	set(key: string, value: string, options?: { ttl?: number }): Promise<void>;

	/** Delete a single cache entry */
	del(key: string): Promise<void>;

	/** Delete all cache entries matching a glob-style pattern (e.g., "route:clubs:*") */
	delByPattern(pattern: string): Promise<void>;

	/**
	 * Try to claim a short-lived exclusive lock, returning `true` only to the caller that won it.
	 *
	 * Optional. The router already single-flights concurrent work per key *within a process*, but
	 * that map is per-instance, so N replicas serving the same stale key each run their own
	 * background revalidation and hit the origin N times. A store backed by shared state (Redis
	 * `SET NX EX`) can collapse that to one; without it, behaviour is unchanged.
	 *
	 * Implementations must be atomic — a get-then-set would let two callers both see "free" and
	 * both win. The lock is advisory and self-expiring: it is never explicitly released, so a
	 * replica that dies mid-revalidation cannot wedge the key.
	 */
	acquireLock?(key: string, ttlSeconds: number): Promise<boolean>;
}

/**
 * Per-route cache configuration
 */
export type RouteCacheConfig = {
	/**
	 * Redis TTL in seconds. Also used as `max-age` in `Cache-Control`.
	 * The actual Redis TTL is extended by `swr` so data persists during stale-while-revalidate.
	 */
	ttl: number;

	/**
	 * `stale-while-revalidate` value in seconds.
	 * Defaults to `ttl * 10`.
	 */
	swr?: number;

	/**
	 * Cache key prefix for this route.
	 * Supports `{paramName}` placeholders that get replaced with path param values.
	 * Used for targeted cache busting — e.g., key: "clubs" lets you bust all club list caches,
	 * while key: "club:{id}" lets you bust a specific club's detail cache.
	 */
	key: string;

	/**
	 * Query parameter names that affect the response.
	 * When specified, these params are included in the cache key so different queries
	 * produce different cache entries (e.g., pagination).
	 */
	varyByQuery?: string[];

	/**
	 * When true, the cache key includes the user ID (or "anon"), so each user gets
	 * their own cache entry. Required for any response that contains or is filtered
	 * by user-specific data.
	 *
	 * Defaults to `false` (a single shared entry per key), because per-user entries
	 * destroy hit rates on public routes. A route with `auth: true` must set this
	 * explicitly — the router refuses to register it otherwise, so a cross-user leak
	 * cannot happen by omission.
	 */
	varyByUser?: boolean;

	/**
	 * Opt-in server-side stale-while-revalidate. When true, entries are stored with
	 * a soft expiry at `ttl`; after it passes the cached response is still served
	 * immediately (with `X-Cache: STALE`) while the handler refreshes it in the
	 * background. The hard Redis TTL remains `ttl + swr`.
	 */
	serveStale?: boolean;
};

// ============================================================================
// Router Options
// ============================================================================

/**
 * Options for creating a router
 */
export type RouterOptions = {
	/** Default rate limit configuration applied to all routes */
	defaultRateLimit?: RateLimitConfig | false;

	/** Global cache configuration */
	cache?: {
		/** Cache store implementation (e.g., Redis) */
		store: CacheStore;

		/** Prefix for all cache keys (default: "route:") */
		keyPrefix?: string;

		/** Default stale-while-revalidate value when not specified on a route (default: ttl * 10) */
		defaultSwr?: number;
	};

	/**
	 * What to do when two routes with the same method and matching path shape are
	 * registered (the second is unreachable dead code).
	 * - "error" (default): log via `console.error`, keep the first registration
	 * - "throw": fail at registration time
	 * - "ignore": say nothing
	 */
	onDuplicateRoute?: "throw" | "error" | "ignore";

	/**
	 * What to do when a route has both `auth: true` and `cache` but no explicit
	 * `cache.varyByUser`. Defaults to "throw" — see `RouteCacheConfig.varyByUser`.
	 */
	onMissingVaryByUser?: "throw" | "warn";
};

// ============================================================================
// OpenAPI Types
// ============================================================================

/**
 * OpenAPI specification structure
 */
export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
	};
	servers: Array<{ url: string; description?: string }>;
	paths: Record<string, Record<string, unknown>>;
	components?: {
		schemas?: Record<string, unknown>;
		securitySchemes?: Record<string, unknown>;
	};
}

/**
 * Custom OpenAPI schema contributor
 * Allows extending the generated OpenAPI spec with custom paths and components
 */
type OpenAPISchemaFragment = {
	paths?: Record<string, Record<string, unknown>>;
	components?: Record<string, unknown>;
};

/**
 * A contributor may be supplied either as a plain fragment or as a (possibly async) factory —
 * `generateOpenAPISpec` accepts both.
 */
export type OpenAPISchemaContributor =
	| OpenAPISchemaFragment
	| (() => OpenAPISchemaFragment | Promise<OpenAPISchemaFragment>);

/**
 * Options for OpenAPI generation
 */
export type OpenAPIOptions = {
	/** API title */
	title?: string;
	/** API version */
	version?: string;
	/** API description */
	description?: string;
	/** Custom schema contributors (e.g., better-auth schemas) */
	schemaContributors?: OpenAPISchemaContributor[];
	/** Security schemes to include */
	securitySchemes?: Record<string, unknown>;
};
