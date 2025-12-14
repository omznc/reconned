import { eq } from "drizzle-orm";
import { z } from "zod";
import { user as userTable } from "./drizzle/schema";
import { auth } from "./lib/auth";
import { addCORSHeaders, handleCORS } from "./lib/cors";
import { db } from "./lib/db";
import { env } from "./lib/env";
import { handleOpenAPIRoutes } from "./lib/openapi";
import {
	type InferErrorResponseType,
	type InferResponseType,
	type InferSuccessResponseType,
	jsonResponse,
	type ResponseHelper,
	type RouteHandler,
	type RouteHandlerParams,
	Router,
	type RouteSchema,
} from "./lib/router";
import { adminRouter } from "./routes/admin";
import { clubsRouter } from "./routes/clubs";
import { countriesRouter } from "./routes/countries";
import { dashboardRouter } from "./routes/dashboard";
import { eventsRouter } from "./routes/events";
import { publicRouter } from "./routes/public";
import { usersRouter } from "./routes/users";
import { utilsRouter } from "./routes/utils";

const corsOrigins = env.CORS_ORIGINS.split(",").map((origin: string) => origin.trim());

const mainRouter = new Router();

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

	const match = mainRouter.match(request);
	if (!match) {
		return new Response("Not Found", { status: 404 });
	}

	const { route, params } = match;

	if (route.auth && !user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (route.schema?.params) {
		try {
			const validatedParams = route.schema.params.parse(params);
			Object.assign(params, validatedParams);
		} catch (error) {
			if (error instanceof z.ZodError) {
				return addCORSHeaders(
					new Response(JSON.stringify({ error: "Invalid parameters", details: error.issues }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					}),
					request,
					corsOrigins,
				);
			}
		}
	}

	let query: unknown;
	if (route.schema?.query) {
		try {
			const queryObj = Object.fromEntries(url.searchParams.entries());
			query = route.schema.query.parse(queryObj);
		} catch (error) {
			if (error instanceof z.ZodError) {
				return addCORSHeaders(
					new Response(JSON.stringify({ error: "Invalid query parameters", details: error.issues }), {
						status: 400,
						headers: { "Content-Type": "application/json" },
					}),
					request,
					corsOrigins,
				);
			}
		}
	}

	type InferBodyType<TSchema extends RouteSchema | undefined> = TSchema extends { body: z.ZodTypeAny }
		? z.infer<TSchema["body"]>
		: undefined;

	type InferQueryType<TSchema extends RouteSchema | undefined> = TSchema extends {
		query: z.ZodTypeAny;
	}
		? z.infer<TSchema["query"]>
		: undefined;

	const hasBodySchema =
		route.schema?.body && (request.method === "POST" || request.method === "PUT" || request.method === "PATCH");

	let body: InferBodyType<typeof route.schema>;
	if (hasBodySchema && route.schema?.body) {
		try {
			const contentType = request.headers.get("content-type");
			if (!contentType?.includes("application/json")) {
				return addCORSHeaders(
					new Response(
						JSON.stringify({
							error: "Invalid request body",
							details: [
								{
									path: "",
									message: "Content-Type must be application/json",
									code: "custom",
								},
							],
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					),
					request,
					corsOrigins,
				);
			}

			let rawBody: unknown;
			try {
				rawBody = await request.json();
			} catch {
				return addCORSHeaders(
					new Response(
						JSON.stringify({
							error: "Invalid request body",
							details: [
								{
									path: "",
									message: "Request body must be valid JSON",
									code: "custom",
								},
							],
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					),
					request,
					corsOrigins,
				);
			}

			const parseResult = route.schema.body.safeParse(rawBody);
			if (!parseResult.success) {
				return addCORSHeaders(
					new Response(
						JSON.stringify({
							error: "Invalid request body",
							details: parseResult.error.issues.map((issue) => ({
								path: issue.path.length > 0 ? issue.path.join(".") : "root",
								message: issue.message,
								code: issue.code,
							})),
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					),
					request,
					corsOrigins,
				);
			}
			body = parseResult.data as InferBodyType<typeof route.schema>;
		} catch (error) {
			if (error instanceof z.ZodError) {
				return addCORSHeaders(
					new Response(
						JSON.stringify({
							error: "Invalid request body",
							details: error.issues.map((issue) => ({
								path: issue.path.length > 0 ? issue.path.join(".") : "root",
								message: issue.message,
								code: issue.code,
							})),
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					),
					request,
					corsOrigins,
				);
			}
			return addCORSHeaders(
				new Response(
					JSON.stringify({
						error: "Failed to parse request body",
						message: error instanceof Error ? error.message : "Unknown error",
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				),
				request,
				corsOrigins,
			);
		}
	}

	const createResponseHelper = <TSchema extends RouteSchema | undefined>(
		_schema?: TSchema,
	): ResponseHelper<TSchema> => {
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
	};

	try {
		const hasQuerySchema = !!route.schema?.query;
		type QueryType = InferQueryType<typeof route.schema>;
		const responseHelper = createResponseHelper(route.schema);
		if (hasBodySchema) {
			type BodyType = InferBodyType<typeof route.schema>;
			if (route.auth) {
				const context = {
					user: user as NonNullable<typeof user>,
					session,
					isAdmin,
				};
				const handler = route.handler as unknown as RouteHandler<
					BodyType,
					QueryType,
					typeof route.schema,
					true
				>;
				const handlerParams = {
					request,
					params,
					context,
					body: body as BodyType,
					response: responseHelper,
					...(hasQuerySchema && { query: query as QueryType }),
				} as RouteHandlerParams<BodyType, QueryType, typeof route.schema, true>;
				const response = await handler(handlerParams);
				return addCORSHeaders(response, request, corsOrigins);
			}
			const context = {
				user,
				session,
				isAdmin,
			};
			const handler = route.handler as unknown as RouteHandler<BodyType, QueryType, typeof route.schema, false>;
			const handlerParams = {
				request,
				params,
				context,
				body: body as BodyType,
				response: responseHelper,
				...(hasQuerySchema && { query: query as QueryType }),
			} as RouteHandlerParams<BodyType, QueryType, typeof route.schema, false>;
			const response = await handler(handlerParams);
			return addCORSHeaders(response, request, corsOrigins);
		}
		if (route.auth) {
			const context = {
				user: user as NonNullable<typeof user>,
				session,
				isAdmin,
			};
			const handler = route.handler as unknown as RouteHandler<undefined, QueryType, typeof route.schema, true>;
			const handlerParams = {
				request,
				params,
				context,
				response: responseHelper,
				...(hasQuerySchema && { query: query as QueryType }),
			} as RouteHandlerParams<undefined, QueryType, typeof route.schema, true>;
			const response = await handler(handlerParams);
			return addCORSHeaders(response, request, corsOrigins);
		}
		const context = {
			user,
			session,
			isAdmin,
		};
		const handler = route.handler as unknown as RouteHandler<undefined, QueryType, typeof route.schema, false>;
		const handlerParams = {
			request,
			params,
			context,
			response: responseHelper,
			...(hasQuerySchema && { query: query as QueryType }),
		} as RouteHandlerParams<undefined, QueryType, typeof route.schema, false>;
		const response = await handler(handlerParams);
		console.log(`${request.method} ${new URL(request.url).pathname} - ${response.status}`);
		return addCORSHeaders(response, request, corsOrigins);
	} catch (error) {
		console.error("Error handling request:", error);
		return new Response(JSON.stringify({ error: "Internal Server Error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}

mainRouter.use(countriesRouter);
mainRouter.use(usersRouter);
mainRouter.use(clubsRouter);
mainRouter.use(eventsRouter);
mainRouter.use(dashboardRouter);
mainRouter.use(utilsRouter);
mainRouter.use(adminRouter);
mainRouter.use(publicRouter);

Bun.serve({
	port: 3002,
	fetch: handleRequest,
});

console.log(`Server is running on ${env.BETTER_AUTH_URL}`);
