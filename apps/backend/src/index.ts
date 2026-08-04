import {
	addCORSHeaders,
	authMiddleware,
	correlationMiddleware,
	handleCORS,
	jsonResponse,
	pathMiddleware,
	Router,
} from "@reconned/router";
import { eq } from "drizzle-orm";
import { user as userTable } from "./drizzle/schema";
import { AUTHORIZATION_SERVER_METADATA_PATH, OAUTH_DISCOVERY_PATHS, withAgentAuth } from "./lib/agent-auth";
import { auth } from "./lib/auth";
import { rateLimitKey, redisCacheStore, redisRateLimitStore } from "./lib/cache";
import { db } from "./lib/db";
import { env } from "./lib/env";
import { loggingMiddleware } from "./lib/middlewares/logging";
import { wideEventsMiddleware } from "./lib/middlewares/wide-events";
import { runMigrations } from "./lib/migrate";
import { handleOpenAPIRoutes } from "./lib/openapi";
import { logger } from "./lib/posthog";
import { adminRouter } from "./routes/admin";
import { alliancesRouter } from "./routes/alliances";
import { apiKeysRouter } from "./routes/api-keys";
import { clubsRouter } from "./routes/clubs";
import { countriesRouter } from "./routes/countries";
import { dashboardRouter } from "./routes/dashboard";
import { eventsRouter } from "./routes/events";
import { handleMCPRequest, mcpPosthog } from "./routes/mcp";
import { publicRouter } from "./routes/public";
import { reviewsRouter } from "./routes/reviews";
import { usersRouter } from "./routes/users";
import { utilsRouter } from "./routes/utils";
import { scheduler } from "./tasks/scheduler";

const corsOrigins = env.CORS_ORIGINS.split(",").map((origin: string) => origin.trim());

if (process.env.NODE_ENV === "production") {
	// Bracket the migration on stdout: it runs before the server binds, so a hung or failed
	// migration is otherwise indistinguishable from a container that never started.
	console.log("Running database migrations...");
	await runMigrations();
	console.log("Database migrations complete");
}
const mainRouter = new Router({
	// Deliberately generous — this is an abuse ceiling, not a quota. Normal page loads fan out to
	// several API calls, so the limit has to sit well above regular interactive usage.
	defaultRateLimit: {
		windowMs: 60_000,
		maxRequests: 600,
		// Redis-backed: the router's default store is a per-process Map, which each replica would
		// enforce independently.
		store: redisRateLimitStore,
		keyGenerator: rateLimitKey,
	},
	cache: {
		store: redisCacheStore,
		keyPrefix: "route:",
	},
	// Registering the same method + path shape twice makes the second one unreachable, and the
	// OpenAPI generator publishes the *last* registration's schema while the *first* serves
	// traffic. That mismatch has silently broken shipped UI more than once (a blank registrations
	// chart, and audit-log rows missing their user column). Fail at boot instead of at runtime.
	onDuplicateRoute: "throw",
});

mainRouter.middleware(correlationMiddleware());
mainRouter.middleware(wideEventsMiddleware());
mainRouter.middleware(loggingMiddleware);

mainRouter.middleware(
	pathMiddleware(
		"/api/admin",
		authMiddleware({
			requireAuth: true,
			roles: ["admin"],
		}),
	),
);

async function handleBetterAuth(request: Request): Promise<Response> {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/api/auth")) {
		return new Response("Not Found", { status: 404 });
	}

	const response = await auth.handler(request);

	// better-auth generates RFC 8414 metadata but knows nothing about auth.md, so the
	// `agent_auth` block is merged in here rather than upstream. Done at this layer, not in
	// the web app's proxy, because the edge may route the discovery paths straight here —
	// see lib/agent-auth.ts.
	if (url.pathname === AUTHORIZATION_SERVER_METADATA_PATH && response.ok) {
		const augmented = withAgentAuth(await response.text(), env.FRONTEND_URL);
		const headers = new Headers(response.headers);
		// The body length changed; forwarding the old value would describe a body we are
		// not sending.
		headers.delete("content-length");
		return addCORSHeaders(new Response(augmented, { status: response.status, headers }), request, corsOrigins);
	}

	return addCORSHeaders(response, request, corsOrigins);
}

async function handleRequest(request: Request): Promise<Response> {
	const corsResponse = handleCORS(request, corsOrigins);
	if (corsResponse) {
		return corsResponse;
	}

	const url = new URL(request.url);

	const openApiResponse = await handleOpenAPIRoutes(
		request,
		[
			countriesRouter,
			usersRouter,
			clubsRouter,
			eventsRouter,
			reviewsRouter,
			dashboardRouter,
			utilsRouter,
			adminRouter,
			publicRouter,
			alliancesRouter,
			apiKeysRouter,
		],
		corsOrigins,
	);
	if (openApiResponse) {
		return openApiResponse;
	}

	if (url.pathname.startsWith("/api/auth")) {
		return handleBetterAuth(request);
	}

	// Root-level OAuth discovery. better-auth only serves these under its own base path, but
	// agents and scanners read them off the site root and the production edge forwards them
	// here unprefixed, so map them onto the base path rather than 404ing.
	if (OAUTH_DISCOVERY_PATHS.has(url.pathname)) {
		const target = new URL(`/api/auth${url.pathname}${url.search}`, url.origin).toString();
		return handleBetterAuth(new Request(target, request));
	}

	if (url.pathname === "/api/mcp") {
		return handleMCPRequest(request, mainRouter);
	}

	let user: { id: string; email: string; name: string; role?: string } | undefined;
	let session: { id: string } | undefined;
	let isAdmin = false;

	// Only /api/public/ is genuinely anonymous. Any other route may be authenticated by cookie,
	// Bearer token or API key, so the session must always be resolved — with session cookie
	// caching enabled in lib/auth.ts this is a local check, not a Redis round-trip.
	const shouldCheckSession = !url.pathname.startsWith("/api/public/");

	if (shouldCheckSession) {
		try {
			const sessionData = await auth.api.getSession({
				headers: request.headers,
			});
			if (sessionData?.user) {
				// `role` is populated by the better-auth admin plugin, so no extra cache/DB lookup.
				const role = sessionData.user.role || undefined;

				user = {
					id: sessionData.user.id,
					email: sessionData.user.email,
					name: sessionData.user.name,
					role,
				};

				isAdmin = role === "admin";
			}
			if (sessionData?.session) {
				session = {
					id: sessionData.session.id,
				};
			}
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Error getting session",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	// The session above comes from a signed cookie snapshot that may be up to `cookieCache.maxAge`
	// seconds stale (see lib/auth.ts). That is an acceptable trade for ordinary routes, but it
	// means a just-demoted or just-banned admin would keep privileged access for that window.
	// Admin traffic is low volume, so re-read the authoritative role by primary key here rather
	// than trusting the cached claim.
	if (user && url.pathname.startsWith("/api/admin")) {
		try {
			const currentUserData = await db
				.select({ role: userTable.role, banned: userTable.banned })
				.from(userTable)
				.where(eq(userTable.id, user.id))
				.limit(1);

			const currentUser = currentUserData[0];
			const currentRole = currentUser?.banned ? undefined : currentUser?.role || undefined;

			user = { ...user, role: currentRole };
			isAdmin = currentRole === "admin";
		} catch (error) {
			// Fail closed: if the role cannot be confirmed, do not grant admin access.
			user = { ...user, role: undefined };
			isAdmin = false;
			logger.emit({
				severityText: "error",
				body: "Could not verify admin role, denying access",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}
	}

	const context = {
		user,
		session,
		isAdmin,
		requestId: "",
		requestStartTime: 0,
	};

	const response = await mainRouter.handle(request, context, jsonResponse);
	return addCORSHeaders(response, request, corsOrigins);
}

mainRouter.use(countriesRouter, "/api");
mainRouter.use(usersRouter, "/api");
mainRouter.use(clubsRouter, "/api");
mainRouter.use(eventsRouter, "/api");
mainRouter.use(reviewsRouter, "/api");
mainRouter.use(dashboardRouter, "/api");
mainRouter.use(utilsRouter, "/api");
mainRouter.use(adminRouter, "/api");
mainRouter.use(publicRouter, "/api");
mainRouter.use(alliancesRouter, "/api");
mainRouter.use(apiKeysRouter, "/api");

export const server = Bun.serve({
	port: Number(process.env.PORT) || 3002,
	fetch: handleRequest,
});

// Deliberately stdout, not just PostHog: container logs must show the bound port, because a
// PORT env injected by the platform can silently diverge from what the proxy forwards to.
console.log(`Backend listening on http://${server.hostname}:${server.port}`);

logger.emit({
	severityText: "info",
	body: "Server started",
	attributes: {
		url: env.BETTER_AUTH_URL,
	},
});

scheduler.start();

process.on("SIGTERM", async () => {
	logger.emit({
		severityText: "info",
		body: "SIGTERM received, shutting down gracefully",
	});
	scheduler.stop();
	await mcpPosthog.shutdown();
	process.exit(0);
});

process.on("SIGINT", async () => {
	logger.emit({
		severityText: "info",
		body: "SIGINT received, shutting down gracefully",
	});
	scheduler.stop();
	await mcpPosthog.shutdown();
	process.exit(0);
});
