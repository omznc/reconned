import { eq } from "drizzle-orm";
import { user as userTable } from "./drizzle/schema";
import { auth } from "./lib/auth";
import { addCORSHeaders, handleCORS } from "./lib/cors";
import { db } from "./lib/db";
import { env } from "./lib/env";
import { authMiddleware, pathMiddleware } from "./lib/middlewares/index";
import { loggingMiddleware } from "./lib/middlewares/logging";
import { handleOpenAPIRoutes } from "./lib/openapi";
import { jsonResponse, Router } from "./lib/router";
import { adminRouter } from "./routes/admin";
import { clubsRouter } from "./routes/clubs";
import { countriesRouter } from "./routes/countries";
import { dashboardRouter } from "./routes/dashboard";
import { eventsRouter } from "./routes/events";
import { publicRouter } from "./routes/public";
import { reviewsRouter } from "./routes/reviews";
import { usersRouter } from "./routes/users";
import { utilsRouter } from "./routes/utils";

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
			user = {
				id: sessionData.user.id,
				email: sessionData.user.email,
				name: sessionData.user.name,
				role: sessionData.user.role || undefined,
			};

			const userRecord = await db
				.select({ role: userTable.role })
				.from(userTable)
				.where(eq(userTable.id, user.id))
				.limit(1);
			isAdmin = userRecord[0]?.role === "admin";
		}
		if (sessionData?.session) {
			session = {
				id: sessionData.session.id,
			};
		}
	} catch (error) {
		console.error("Error getting session:", error);
	}

	const context = {
		user,
		session,
		isAdmin,
	};

	const response = await mainRouter.handle(request, context, jsonResponse);
	return addCORSHeaders(response, request, corsOrigins);
}

mainRouter.use(countriesRouter);
mainRouter.use(usersRouter);
mainRouter.use(clubsRouter);
mainRouter.use(eventsRouter);
mainRouter.use(reviewsRouter);
mainRouter.use(dashboardRouter);
mainRouter.use(utilsRouter);
mainRouter.use(adminRouter);
mainRouter.use(publicRouter);

Bun.serve({
	port: 3002,
	fetch: handleRequest,
});

console.log(`Server is running on ${env.BETTER_AUTH_URL}`);
