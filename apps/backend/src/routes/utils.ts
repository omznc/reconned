import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, event, review, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { apiError } from "../lib/errors";
import { logger } from "../lib/posthog";
import { redis } from "../lib/redis";
import { Router } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const utilsRouter = new Router();

const baseUserSchema = createSelectSchema(user);
const baseEventSchema = createSelectSchema(event);
const baseReviewSchema = createSelectSchema(review);

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

		if (includeClubs) {
			const clubWhereConditions = [eq(club.isPrivate, false)];
			if (search) {
				const searchCondition = or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`));
				if (searchCondition) {
					clubWhereConditions.push(searchCondition);
				}
			}
			const clubWhere = and(...clubWhereConditions);

			const clubsData = await db
				.select({
					id: club.id,
					name: club.name,
					slug: club.slug,
					logo: club.logo,
					location: club.location,
					verified: club.verified,
				})
				.from(club)
				.where(clubWhere)
				.orderBy(desc(club.verified), club.name)
				.limit(1000);

			const clubsWithMemberCounts = await Promise.all(
				clubsData.map(async (c) => {
					const memberCount = await db
						.select({ count: count() })
						.from(clubMembership)
						.where(eq(clubMembership.clubId, c.id));
					return {
						...c,
						_count: { members: Number(memberCount[0]?.count || 0) },
					};
				}),
			);

			for (const club of clubsWithMemberCounts) {
				let relevanceScore = 0;
				if (search) {
					const nameMatch = club.name.toLowerCase().includes(search.toLowerCase());
					const locationMatch = club.location?.toLowerCase().includes(search.toLowerCase());
					if (nameMatch) {
						relevanceScore += 10;
						if (club.name.toLowerCase().startsWith(search.toLowerCase())) {
							relevanceScore += 5;
						}
					}
					if (locationMatch) {
						relevanceScore += 3;
					}
					if (club.verified) {
						relevanceScore += 1;
					}
				} else {
					relevanceScore = club.verified ? 2 : 1;
				}

				allItems.push({
					type: "club",
					id: club.id,
					name: club.name,
					relevanceScore,
					data: club,
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

			const usersData = await db
				.select({
					id: user.id,
					name: user.name,
					slug: user.slug,
					image: user.image,
					callsign: user.callsign,
				})
				.from(user)
				.where(userWhere)
				.orderBy(desc(user.createdAt))
				.limit(1000);

			const usersWithMemberships = await Promise.all(
				usersData.map(async (u) => {
					const memberships = await db
						.select({
							id: clubMembership.id,
							userId: clubMembership.userId,
							clubId: clubMembership.clubId,
							role: clubMembership.role,
						})
						.from(clubMembership)
						.where(eq(clubMembership.userId, u.id));

					const membershipsWithClubs = await Promise.all(
						memberships.map(async (m) => {
							const clubData = await db
								.select({
									id: club.id,
									name: club.name,
									isPrivate: club.isPrivate,
								})
								.from(club)
								.where(eq(club.id, m.clubId))
								.limit(1);

							const clubItem = clubData[0];
							if (!clubItem || clubItem.isPrivate) {
								return null;
							}

							return {
								...m,
								club: {
									name: clubItem.name,
								},
							};
						}),
					);

					return {
						...u,
						clubMembership: membershipsWithClubs.filter((m) => m !== null),
					};
				}),
			);

			for (const user of usersWithMemberships) {
				let relevanceScore = 0;
				if (search) {
					const nameMatch = user.name?.toLowerCase().includes(search.toLowerCase());
					if (nameMatch) {
						relevanceScore += 10;
						if (user.name?.toLowerCase().startsWith(search.toLowerCase())) {
							relevanceScore += 5;
						}
					}
				} else {
					relevanceScore = 1;
				}

				allItems.push({
					type: "user",
					id: user.id,
					name: user.name || "",
					relevanceScore,
					data: {
						id: user.id,
						name: user.name,
						slug: user.slug,
						image: user.image,
						callsign: user.callsign,
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
					.where(eq(clubMembership.userId, requestingUserId));

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

			const eventsWithClubs = await db
				.select({
					// Event fields
					id: event.id,
					name: event.name,
					description: event.description,
					location: event.location,
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
				})
				.from(event)
				.leftJoin(club, eq(event.clubId, club.id))
				.where(eventWhere)
				.orderBy(event.dateStart)
				.limit(1000);

			const formattedEvents = eventsWithClubs.map((e) => ({
				id: e.id,
				name: e.name,
				description: e.description,
				location: e.location,
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

			for (const event of formattedEvents) {
				let relevanceScore = 0;
				if (search) {
					const nameMatch = event.name?.toLowerCase().includes(search.toLowerCase());
					const locationMatch = event.location?.toLowerCase().includes(search.toLowerCase());
					if (nameMatch) {
						relevanceScore += 10;
						if (event.name?.toLowerCase().startsWith(search.toLowerCase())) {
							relevanceScore += 5;
						}
					}
					if (locationMatch) {
						relevanceScore += 3;
					}
				} else {
					relevanceScore = 1;
				}

				allItems.push({
					type: "event",
					id: event.id,
					name: event.name || "",
					relevanceScore,
					data: event,
				});
			}
		}

		allItems.sort((a, b) => b.relevanceScore - a.relevanceScore);

		const total = allItems.length;
		const paginatedItems = allItems.slice(offset, offset + perPage);

		const searchItemSchema = z.discriminatedUnion("type", [
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
			items: paginatedItems as z.infer<typeof searchItemSchema>[],
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
				search: z.string().optional(),
				filter: z.string().optional(),
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
	"/reviews",
	async ({ query, response }) => {
		const clubId = query?.clubId;
		const eventId = query?.eventId;
		const userId = query?.userId;

		const whereConditions = [];

		if (clubId) {
			whereConditions.push(eq(review.clubId, clubId));
		}
		if (eventId) {
			whereConditions.push(eq(review.eventId, eventId));
		}
		if (userId) {
			whereConditions.push(eq(review.userId, userId));
		}

		if (whereConditions.length === 0) {
			throw apiError.validation("clubId, eventId, or userId is required");
		}

		const reviews = await db
			.select()
			.from(review)
			.where(and(...whereConditions))
			.orderBy(desc(review.createdAt));

		return response.json({ reviews });
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Get reviews",
			description: "Get reviews filtered by clubId, eventId, or userId",
			query: z.object({
				clubId: z.string().optional(),
				eventId: z.string().optional(),
				userId: z.string().optional(),
			}),
			response: {
				200: z.object({
					reviews: z.array(baseReviewSchema),
				}),
			},
		},
	},
);

utilsRouter.get(
	"/reviews/{type}/{id}",
	async ({ params, response }) => {
		const type = params?.type;
		const id = params?.id;

		if (!type || !id) {
			throw apiError.validation("Type and ID are required");
		}

		let whereCondition: ReturnType<typeof eq>;

		switch (type) {
			case "club":
				whereCondition = eq(review.clubId, id);
				break;
			case "event":
				whereCondition = eq(review.eventId, id);
				break;
			case "user":
				whereCondition = eq(review.userId, id);
				break;
			default:
				throw apiError.validation("Invalid type");
		}

		const reviews = await db.select().from(review).where(whereCondition).orderBy(desc(review.createdAt));

		return response.json({ reviews });
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Get reviews for specific entity",
			description: "Get reviews for a specific club, event, or user",
			params: z.object({
				type: z.enum(["club", "event", "user"]),
				id: z.string(),
			}),
			response: {
				200: z.object({
					reviews: z.array(baseReviewSchema),
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
