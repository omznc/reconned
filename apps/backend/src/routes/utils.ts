import { Router } from "@reconned/router";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, event, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";
import { redis } from "../lib/redis";
import { logoTileOf, logoTileResponseSchema, paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const utilsRouter = new Router();

const baseUserSchema = createSelectSchema(user);
const baseEventSchema = createSelectSchema(event);

utilsRouter.get(
	"/search",
	async ({ query, response, context }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const filterParam = query?.filter || "club,user,event";
		const filters = filterParam.split(",").map((f) => f.trim().toLowerCase());

		const includeClubs = filters.includes("club");
		const includeUsers = filters.includes("user");
		const includeEvents = filters.includes("event");

		const allItems: Array<{
			type: "club" | "user" | "event";
			id: string;
			name: string;
			relevanceScore: number;
			data: unknown;
		}> = [];

		// Only the first `offset + perPage` items can ever appear on the requested page, so each
		// branch only needs that many candidates. Items dropped by this limit rank below at least
		// that many items of their own type, so they can never reach the page.
		const candidateLimit = offset + perPage;
		const containsPattern = `%${search}%`;
		const prefixPattern = `${search}%`;

		let clubTotal = 0;
		let userTotal = 0;
		let eventTotal = 0;

		if (includeClubs) {
			const clubWhereConditions = [eq(club.isPrivate, false)];
			if (search) {
				const searchCondition = or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`));
				if (searchCondition) {
					clubWhereConditions.push(searchCondition);
				}
			}
			const clubWhere = and(...clubWhereConditions);

			// Relevance scoring pushed into SQL so ranking happens before the LIMIT.
			const clubRelevance = search
				? sql<number>`(
					CASE WHEN ${club.name} ILIKE ${containsPattern} THEN 10 ELSE 0 END
					+ CASE WHEN ${club.name} ILIKE ${prefixPattern} THEN 5 ELSE 0 END
					+ CASE WHEN ${club.location} ILIKE ${containsPattern} THEN 3 ELSE 0 END
					+ CASE WHEN ${club.verified} THEN 1 ELSE 0 END
				)`
				: sql<number>`(CASE WHEN ${club.verified} THEN 2 ELSE 1 END)`;

			// Grouped-count join instead of one COUNT query per club.
			const clubMemberCounts = db
				.select({
					clubId: clubMembership.clubId,
					count: count().as("member_count"),
				})
				.from(clubMembership)
				.where(eq(clubMembership.status, "ACTIVE"))
				.groupBy(clubMembership.clubId)
				.as("club_member_counts");

			const [clubsData, clubTotalRows] = await Promise.all([
				db
					.select({
						id: club.id,
						name: club.name,
						slug: club.slug,
						logo: club.logo,
						logoTile: club.logoTile,
						location: club.location,
						verified: club.verified,
						memberCount: sql<number>`COALESCE(${clubMemberCounts.count}, 0)`,
						relevanceScore: clubRelevance,
					})
					.from(club)
					.leftJoin(clubMemberCounts, eq(club.id, clubMemberCounts.clubId))
					.where(clubWhere)
					.orderBy(desc(clubRelevance), desc(club.verified), club.name)
					.limit(candidateLimit),
				db.select({ count: count() }).from(club).where(clubWhere),
			]);

			clubTotal = Number(clubTotalRows[0]?.count || 0);

			for (const c of clubsData) {
				allItems.push({
					type: "club",
					id: c.id,
					name: c.name,
					relevanceScore: Number(c.relevanceScore),
					data: {
						id: c.id,
						name: c.name,
						slug: c.slug,
						logo: c.logo,
						logoTile: logoTileOf(c.logoTile),
						location: c.location,
						verified: c.verified,
						_count: { members: Number(c.memberCount) },
					},
				});
			}
		}

		if (includeUsers) {
			const userWhereConditions = [eq(user.isPrivate, false)];
			if (search) {
				const searchCondition = ilike(user.name, `%${search}%`);
				if (searchCondition) {
					userWhereConditions.push(searchCondition);
				}
			}
			const userWhere = and(...userWhereConditions);

			const userRelevance = search
				? sql<number>`(
					CASE WHEN ${user.name} ILIKE ${containsPattern} THEN 10 ELSE 0 END
					+ CASE WHEN ${user.name} ILIKE ${prefixPattern} THEN 5 ELSE 0 END
				)`
				: sql<number>`1`;

			// The previous per-user membership/club fan-out was dead work: the emitted `data`
			// payload never included memberships, so it is dropped entirely.
			const [usersData, userTotalRows] = await Promise.all([
				db
					.select({
						id: user.id,
						name: user.name,
						slug: user.slug,
						image: user.image,
						callsign: user.callsign,
						relevanceScore: userRelevance,
					})
					.from(user)
					.where(userWhere)
					// Without a search term every row scores 1; `ORDER BY 1` would be read as a
					// column ordinal by Postgres, so the constant is left out of the ORDER BY.
					.orderBy(...(search ? [desc(userRelevance)] : []), desc(user.createdAt))
					.limit(candidateLimit),
				db.select({ count: count() }).from(user).where(userWhere),
			]);

			userTotal = Number(userTotalRows[0]?.count || 0);

			for (const u of usersData) {
				allItems.push({
					type: "user",
					id: u.id,
					name: u.name || "",
					relevanceScore: Number(u.relevanceScore),
					data: {
						id: u.id,
						name: u.name,
						slug: u.slug,
						image: u.image,
						callsign: u.callsign,
					},
				});
			}
		}

		if (includeEvents) {
			const eventWhereConditions = [];
			if (search) {
				const searchCondition = or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`));
				if (searchCondition) {
					eventWhereConditions.push(searchCondition);
				}
			}

			const isAdmin = context.isAdmin;
			const requestingUserId = context.user?.id;

			const publicClubCondition = sql`
				EXISTS (
					SELECT 1
					FROM "Club" c
					WHERE c."id" = ${event.clubId}
					AND c."isPrivate" = false
				)
			`;

			if (!requestingUserId || !context.user) {
				eventWhereConditions.push(eq(event.isPrivate, false));
				eventWhereConditions.push(publicClubCondition);
			} else if (!isAdmin) {
				const userClubMemberships = await db
					.select({ clubId: clubMembership.clubId })
					.from(clubMembership)
					.where(and(eq(clubMembership.userId, requestingUserId), eq(clubMembership.status, "ACTIVE")));

				const userClubIds = userClubMemberships.map((m) => m.clubId);

				if (userClubIds.length > 0) {
					eventWhereConditions.push(
						or(and(eq(event.isPrivate, false), publicClubCondition), inArray(event.clubId, userClubIds)),
					);
				} else {
					eventWhereConditions.push(eq(event.isPrivate, false));
					eventWhereConditions.push(publicClubCondition);
				}
			}

			const eventWhere = eventWhereConditions.length > 0 ? and(...eventWhereConditions) : undefined;

			const eventRelevance = search
				? sql<number>`(
					CASE WHEN ${event.name} ILIKE ${containsPattern} THEN 10 ELSE 0 END
					+ CASE WHEN ${event.name} ILIKE ${prefixPattern} THEN 5 ELSE 0 END
					+ CASE WHEN ${event.location} ILIKE ${containsPattern} THEN 3 ELSE 0 END
				)`
				: sql<number>`1`;

			const [eventsWithClubs, eventTotalRows] = await Promise.all([
				db
					.select({
						// Event fields
						id: event.id,
						name: event.name,
						description: event.description,
						image: event.image,
						location: event.location,
						slug: event.slug,
						dateStart: event.dateStart,
						dateEnd: event.dateEnd,
						dateRegistrationsOpen: event.dateRegistrationsOpen,
						dateRegistrationsClose: event.dateRegistrationsClose,
						isPrivate: event.isPrivate,
						gearRequirements: event.gearRequirements,
						mapData: event.mapData,
						costPerPerson: event.costPerPerson,
						clubId: event.clubId,
						createdAt: event.createdAt,
						updatedAt: event.updatedAt,
						// Club fields
						clubId_alias: club.id,
						clubName: club.name,
						clubSlug: club.slug,
						clubLogo: club.logo,
						clubVerified: club.verified,
						relevanceScore: eventRelevance,
					})
					.from(event)
					.leftJoin(club, eq(event.clubId, club.id))
					.where(eventWhere)
					// See the users branch: a constant score must not reach the ORDER BY.
					.orderBy(...(search ? [desc(eventRelevance)] : []), event.dateStart)
					.limit(candidateLimit),
				db.select({ count: count() }).from(event).where(eventWhere),
			]);

			eventTotal = Number(eventTotalRows[0]?.count || 0);

			const formattedEvents = eventsWithClubs.map((e) => ({
				relevanceScore: Number(e.relevanceScore),
				id: e.id,
				name: e.name,
				description: e.description,
				image: e.image,
				location: e.location,
				slug: e.slug,
				dateStart: e.dateStart,
				dateEnd: e.dateEnd,
				dateRegistrationsOpen: e.dateRegistrationsOpen,
				dateRegistrationsClose: e.dateRegistrationsClose,
				isPrivate: e.isPrivate,
				gearRequirements: e.gearRequirements,
				mapData: e.mapData,
				costPerPerson: e.costPerPerson,
				clubId: e.clubId,
				createdAt: e.createdAt,
				updatedAt: e.updatedAt,
				club: e.clubId_alias
					? {
							id: e.clubId_alias,
							name: e.clubName,
							slug: e.clubSlug,
							logo: e.clubLogo,
							verified: e.clubVerified,
						}
					: null,
			}));

			for (const { relevanceScore, ...eventData } of formattedEvents) {
				allItems.push({
					type: "event",
					id: eventData.id,
					name: eventData.name || "",
					relevanceScore,
					data: eventData,
				});
			}
		}

		// Stable sort: within an equal score, per-type DB ordering (and club > user > event
		// type precedence) is preserved, matching the previous behaviour.
		allItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

		const total = clubTotal + userTotal + eventTotal;
		const paginatedItems = allItems.slice(offset, offset + perPage);

		const _searchItemSchema = z.discriminatedUnion("type", [
			z.object({
				type: z.literal("club"),
				id: z.string(),
				name: z.string(),
				relevanceScore: z.number(),
				data: z.object({
					id: z.string(),
					name: z.string(),
					slug: z.string().nullable(),
					logo: z.string().nullable(),
					logoTile: logoTileResponseSchema,
					location: z.string().nullable(),
					verified: z.boolean(),
					_count: z.object({ members: z.number() }),
				}),
			}),
			z.object({
				type: z.literal("user"),
				id: z.string(),
				name: z.string(),
				relevanceScore: z.number(),
				data: baseUserSchema.partial(),
			}),
			z.object({
				type: z.literal("event"),
				id: z.string(),
				name: z.string(),
				relevanceScore: z.number(),
				data: baseEventSchema.partial(),
			}),
		]);

		return response.json({
			items: paginatedItems as z.infer<typeof _searchItemSchema>[],
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		});
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Search clubs, users, and events",
			description: "Unified search across clubs, users, and events with pagination and type filtering",
			query: paginationQuerySchema.extend({
				search: z.string().optional().describe("Free-text query matched against club, user, and event names"),
				filter: z
					.string()
					.optional()
					.describe(
						'Comma-separated result types to include: "club", "user", "event". Defaults to all three.',
					),
			}),
			response: {
				200: z.object({
					items: z.array(
						z.discriminatedUnion("type", [
							z.object({
								type: z.literal("club"),
								id: z.string(),
								name: z.string(),
								relevanceScore: z.number(),
								data: z.object({
									id: z.string(),
									name: z.string(),
									slug: z.string().nullable(),
									logo: z.string().nullable(),
									logoTile: logoTileResponseSchema,
									location: z.string().nullable(),
									verified: z.boolean(),
									_count: z.object({ members: z.number() }),
								}),
							}),
							z.object({
								type: z.literal("user"),
								id: z.string(),
								name: z.string(),
								relevanceScore: z.number(),
								data: baseUserSchema.partial(),
							}),
							z.object({
								type: z.literal("event"),
								id: z.string(),
								name: z.string(),
								relevanceScore: z.number(),
								data: baseEventSchema.partial(),
							}),
						]),
					),
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
