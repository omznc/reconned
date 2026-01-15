import { eq } from "drizzle-orm";
import { user as userTable } from "./drizzle/schema";
import { auth } from "./lib/auth";
import { addCORSHeaders, handleCORS } from "./lib/cors";
import { db } from "./lib/db";
import { env } from "./lib/env";
import { authMiddleware, pathMiddleware } from "./lib/middlewares/index";
import { loggingMiddleware } from "./lib/middlewares/logging";
import { handleOpenAPIRoutes } from "./lib/openapi";
import { logger } from "./lib/posthog";
import { jsonResponse, Router } from "./lib/router";
import { adminRouter } from "./routes/admin";
import { alliancesRouter } from "./routes/alliances";
import { clubsRouter } from "./routes/clubs";
import { countriesRouter } from "./routes/countries";
import { dashboardRouter } from "./routes/dashboard";
import { eventsRouter } from "./routes/events";
import { publicRouter } from "./routes/public";
import { reviewsRouter } from "./routes/reviews";
import { usersRouter } from "./routes/users";
import { utilsRouter } from "./routes/utils";
import { scheduler } from "./tasks/scheduler";

const corsOrigins = env.CORS_ORIGINS.split(",").map((origin: string) => origin.trim());

const mainRouter = new Router();

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
		],
		corsOrigins,
	);
	if (openApiResponse) {
		return openApiResponse;
	}

	if (url.pathname.startsWith("/api/auth")) {
		return handleBetterAuth(request);
	}

	let user: { id: string; email: string; name: string; role?: string } | undefined;
	let session: { id: string } | undefined;
	let isAdmin = false;

	try {
		const sessionData = await auth.api.getSession({
			headers: request.headers,
		});
		if (sessionData?.user) {
			const userRecord = await db
				.select({ role: userTable.role })
				.from(userTable)
				.where(eq(userTable.id, sessionData.user.id))
				.limit(1);

			user = {
				id: sessionData.user.id,
				email: sessionData.user.email,
				name: sessionData.user.name,
				role: userRecord[0]?.role || undefined,
			};

			isAdmin = userRecord[0]?.role === "admin";
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

	const context = {
		user,
		session,
		isAdmin,
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

Bun.serve({
	port: 3002,
	fetch: handleRequest,
});

logger.emit({
	severityText: "info",
	body: "Server started",
	attributes: {
		url: env.BETTER_AUTH_URL,
	},
});

scheduler.start();

process.on("SIGTERM", () => {
	logger.emit({
		severityText: "info",
		body: "SIGTERM received, shutting down gracefully",
	});
	scheduler.stop();
	process.exit(0);
});

process.on("SIGINT", () => {
	logger.emit({
		severityText: "info",
		body: "SIGINT received, shutting down gracefully",
	});
	scheduler.stop();
	process.exit(0);
});
