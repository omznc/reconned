import { Router } from "@reconned/router";
import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { club, event, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";
import { redis } from "../lib/redis";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { runSearch, type SearchOptions, searchItemSchema } from "../lib/search";

const utilsRouter = new Router();

const booleanQuery = z.enum(["true", "false"]).optional();

utilsRouter.get(
	"/search",
	async ({ query, response, context }) => {
		// Only the first `offset + perPage` items can ever appear on the requested page, so each
		// type only needs that many candidates. Items dropped by this limit rank below at least
		// that many items of their own type, so they can never reach the page.
		const options: SearchOptions = {
			search: query.search || "",
			candidateLimit: query.page * query.perPage,
			countryId: query.countryId,
			upcomingOnly: query.upcomingOnly === "true",
			registrationOpen: query.registrationOpen === "true",
			verifiedOnly: query.verifiedOnly === "true",
			viewer: { userId: context.user?.id, isAdmin: context.isAdmin },
		};
		return response.json(await runSearch(options, query));
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Search clubs, users, and events",
			description:
				"Unified search across clubs, users, and events with pagination and type filtering. `counts` always holds the total matches per type (after the refine filters, ignoring `filter` and paging). " +
				"`topResult` is the best name match across the included types: an exact name or callsign beats a prefix match, which beats a contains match; ties follow relevance, then club, user, event. It is null without a query. " +
				"Users match on name, callsign and bio; `matchedIn` says which. `countryId` applies to all three types (events and users through their club).",
			query: paginationQuerySchema.extend({
				search: z.string().optional().describe("Free-text query matched against club, user, and event names"),
				filter: z
					.string()
					.optional()
					.describe(
						'Comma-separated result types to include: "club", "user", "event". Defaults to all three.',
					),
				countryId: z.coerce
					.number()
					.int()
					.optional()
					.describe("Only clubs, events and members of clubs in this country"),
				upcomingOnly: booleanQuery.describe("Events: only events that have not started"),
				registrationOpen: booleanQuery.describe("Events: only events whose registration window is open now"),
				verifiedOnly: booleanQuery.describe("Clubs: only verified clubs"),
			}),
			response: {
				200: z.object({
					items: z.array(searchItemSchema),
					counts: z.object({ events: z.number(), clubs: z.number(), users: z.number() }),
					topResult: searchItemSchema.nullable(),
					pagination: paginationResponseSchema,
				}),
			},
			mcpTool: {
				name: "search",
				description:
					"Search clubs, users, and events by name in one call. Prefer this over paging list_clubs/list_users/list_events when looking something up by name.",
			},
		},
	},
);

const validateSlugBodySchema = z.object({
	type: z.enum(["club", "event", "user"]),
	slug: z.string().min(1),
	excludeId: z.string().optional(),
});

utilsRouter.post(
	"/validate-slug",
	async ({ body, response }) => {
		switch (body.type) {
			case "club": {
				const [clubBySlug, clubById] = await Promise.all([
					db.select().from(club).where(eq(club.slug, body.slug)).limit(1),
					db.select().from(club).where(eq(club.id, body.slug)).limit(1),
				]);

				if (body.excludeId) {
					return response.json({
						available: !(clubBySlug[0] && clubBySlug[0].id !== body.excludeId) && !clubById[0],
					});
				}

				return response.json({
					available: clubBySlug.length === 0 && clubById.length === 0,
				});
			}
			case "event": {
				const [eventBySlug, eventById] = await Promise.all([
					db.select().from(event).where(eq(event.slug, body.slug)).limit(1),
					db.select().from(event).where(eq(event.id, body.slug)).limit(1),
				]);

				if (body.excludeId) {
					return response.json({
						available: !(eventBySlug[0] && eventBySlug[0].id !== body.excludeId) && !eventById[0],
					});
				}

				return response.json({
					available: eventBySlug.length === 0 && eventById.length === 0,
				});
			}
			case "user": {
				const [userBySlug, userId] = await Promise.all([
					db.select({ id: user.id }).from(user).where(eq(user.slug, body.slug)).limit(1),
					db.select({ id: user.id }).from(user).where(eq(user.id, body.slug)).limit(1),
				]);

				if (body.excludeId) {
					return response.json({
						available: !(userBySlug[0] && userBySlug[0].id !== body.excludeId) && !userId[0],
					});
				}

				return response.json({
					available: userBySlug.length === 0 && userId.length === 0,
				});
			}
		}
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Validate slug availability",
			description: "Check if a slug is available for club, event, or user",
			body: validateSlugBodySchema,
			response: {
				200: z.object({
					available: z.boolean(),
				}),
			},
		},
	},
);

utilsRouter.get(
	"/sitemap",
	async ({ response }) => {
		const [clubs, events, users] = await Promise.all([
			db
				.select({
					id: club.id,
					slug: club.slug,
					updatedAt: club.updatedAt,
				})
				.from(club)
				.where(eq(club.isPrivate, false)),
			db
				.select({
					id: event.id,
					slug: event.slug,
					updatedAt: event.updatedAt,
				})
				.from(event)
				.where(eq(event.isPrivate, false)),
			db
				.select({
					id: user.id,
					slug: user.slug,
					updatedAt: user.updatedAt,
				})
				.from(user)
				.where(eq(user.isPrivate, false)),
		]);

		return response.json({
			clubs: clubs.map((c) => ({
				id: c.id,
				slug: c.slug,
				updatedAt: c.updatedAt,
			})),
			events: events.map((e) => ({
				id: e.id,
				slug: e.slug,
				updatedAt: e.updatedAt,
			})),
			users: users.map((u) => ({
				id: u.id,
				slug: u.slug,
				updatedAt: u.updatedAt,
			})),
		});
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Generate sitemap data",
			description: "Get all public clubs, events, and users for sitemap generation",
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							updatedAt: z.string(),
						}),
					),
					events: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							updatedAt: z.string(),
						}),
					),
					users: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							updatedAt: z.string(),
						}),
					),
				}),
			},
		},
	},
);

utilsRouter.get(
	"/health",
	async ({ response }) => {
		const timestamp = new Date().toISOString();
		let databaseStatus = "disconnected";
		let redisStatus = "disconnected";
		let databaseLatency = 0;
		let redisLatency = 0;

		try {
			// Check database connectivity and measure latency
			const dbStart = Date.now();
			await db.execute(sql`SELECT 1`);
			databaseLatency = Date.now() - dbStart;
			databaseStatus = "connected";
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Database health check failed",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}

		try {
			// Check Redis connectivity and measure latency
			const redisStart = Date.now();
			await redis.ping();
			redisLatency = Date.now() - redisStart;
			redisStatus = "connected";
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Redis health check failed",
				attributes: {
					error: error instanceof Error ? error.message : String(error),
				},
			});
		}

		const overallStatus = databaseStatus === "connected" && redisStatus === "connected" ? "healthy" : "unhealthy";

		if (overallStatus === "healthy") {
			return response.json({
				status: overallStatus,
				timestamp,
				database: databaseStatus,
				redis: redisStatus,
				databaseLatency: `${databaseLatency}ms`,
				redisLatency: `${redisLatency}ms`,
			});
		}

		// Return unhealthy status
		return new Response(
			JSON.stringify({
				status: overallStatus,
				timestamp,
				database: databaseStatus,
				redis: redisStatus,
				databaseLatency: databaseStatus === "connected" ? `${databaseLatency}ms` : null,
				redisLatency: redisStatus === "connected" ? `${redisLatency}ms` : null,
			}),
			{
				status: 503,
				headers: { "Content-Type": "application/json" },
			},
		);
	},
	{
		rateLimit: false,
		schema: {
			tags: ["Health"],
			summary: "Health check endpoint",
			description: "Check API, database, and Redis health status with latency measurements",
			response: {
				200: z.object({
					status: z.string(),
					timestamp: z.string(),
					database: z.string(),
					redis: z.string(),
					databaseLatency: z.string(),
					redisLatency: z.string(),
				}),
				503: z.object({
					status: z.string(),
					timestamp: z.string(),
					database: z.string(),
					redis: z.string(),
					databaseLatency: z.string().nullable(),
					redisLatency: z.string().nullable(),
				}),
			},
		},
	},
);

export { utilsRouter };
