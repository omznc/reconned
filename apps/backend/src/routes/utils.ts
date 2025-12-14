import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { club, clubMembership, event, review, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { Router } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const utilsRouter = new Router();

const baseUserSchema = createSelectSchema(user);
const baseEventSchema = createSelectSchema(event);
const baseReviewSchema = createSelectSchema(review);

utilsRouter.get(
	"/api/search",
	async ({ query, response }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const type = query?.type || "all";

		if (!search || search.length < 2) {
			return response.json({
				clubs: [],
				users: [],
				events: [],
				pagination: {
					clubs: { page: 1, perPage, total: 0, totalPages: 0 },
					users: { page: 1, perPage, total: 0, totalPages: 0 },
					events: { page: 1, perPage, total: 0, totalPages: 0 },
				},
			});
		}

		const results: {
			clubs: Array<{
				id: string;
				name: string;
				slug: string | null;
				logo: string | null;
				location: string | null;
				verified: boolean;
				_count: { members: number };
			}>;
			users: Array<z.infer<typeof baseUserSchema>>;
			events: Array<z.infer<typeof baseEventSchema>>;
			pagination: {
				clubs: { page: number; perPage: number; total: number; totalPages: number };
				users: { page: number; perPage: number; total: number; totalPages: number };
				events: { page: number; perPage: number; total: number; totalPages: number };
			};
		} = {
			clubs: [],
			users: [],
			events: [],
			pagination: {
				clubs: { page, perPage, total: 0, totalPages: 0 },
				users: { page, perPage, total: 0, totalPages: 0 },
				events: { page, perPage, total: 0, totalPages: 0 },
			},
		};

		if (type === "all" || type === "clubs") {
			const clubWhere = and(
				eq(club.isPrivate, false),
				or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)),
			);

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
				.limit(perPage)
				.offset(offset);

			const clubsTotalData = await db.select({ count: count() }).from(club).where(clubWhere);

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

			results.clubs = clubsWithMemberCounts;
			results.pagination.clubs = {
				page,
				perPage,
				total: Number(clubsTotalData[0]?.count || 0),
				totalPages: Math.ceil(Number(clubsTotalData[0]?.count || 0) / perPage),
			};
		}

		if (type === "all" || type === "users") {
			const userWhere = and(
				or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`)),
				eq(user.isPrivate, false),
			);

			const [usersData, usersTotalData] = await Promise.all([
				db
					.select()
					.from(user)
					.where(userWhere)
					.orderBy(user.role, desc(user.createdAt))
					.limit(perPage)
					.offset(offset),
				db.select({ count: count() }).from(user).where(userWhere),
			]);

			results.users = usersData as z.infer<typeof baseUserSchema>[];
			results.pagination.users = {
				page,
				perPage,
				total: Number(usersTotalData[0]?.count || 0),
				totalPages: Math.ceil(Number(usersTotalData[0]?.count || 0) / perPage),
			};
		}

		if (type === "all" || type === "events") {
			const eventWhere = and(
				eq(event.isPrivate, false),
				or(ilike(event.name, `%${search}%`), ilike(event.location, `%${search}%`)),
			);

			const [eventsData, eventsTotalData] = await Promise.all([
				db.select().from(event).where(eventWhere).orderBy(event.dateStart).limit(perPage).offset(offset),
				db.select({ count: count() }).from(event).where(eventWhere),
			]);

			results.events = eventsData.map((e) => ({
				...e,
				gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
			}));
			results.pagination.events = {
				page,
				perPage,
				total: Number(eventsTotalData[0]?.count || 0),
				totalPages: Math.ceil(Number(eventsTotalData[0]?.count || 0) / perPage),
			};
		}

		return response.json(results);
	},
	{
		schema: {
			tags: ["Utils"],
			summary: "Search clubs, users, and events",
			description: "Search across clubs, users, and events with pagination and type filtering",
			query: paginationQuerySchema.extend({
				search: z.string(),
				type: z.enum(["all", "clubs", "users", "events"]).optional(),
			}),
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							slug: z.string().nullable(),
							logo: z.string().nullable(),
							location: z.string().nullable(),
							verified: z.boolean(),
							_count: z.object({ members: z.number() }),
						}),
					),
					users: z.array(baseUserSchema.partial()),
					events: z.array(baseEventSchema.partial()),
					pagination: z.object({
						clubs: paginationResponseSchema,
						users: paginationResponseSchema,
						events: paginationResponseSchema,
					}),
				}),
			},
		},
	},
);

const validateSlugBodySchema = z.object({
	type: z.enum(["club", "event", "user"]),
	slug: z.string().min(1),
});

utilsRouter.post(
	"/api/validate-slug",
	async ({ body, response }) => {
		switch (body.type) {
			case "club": {
				const [clubBySlug, clubById] = await Promise.all([
					db.select().from(club).where(eq(club.slug, body.slug)).limit(1),
					db.select().from(club).where(eq(club.id, body.slug)).limit(1),
				]);

				return response.json({
					available: !clubBySlug[0] && !clubById[0],
				});
			}
			case "event": {
				const [eventBySlug, eventById] = await Promise.all([
					db.select().from(event).where(eq(event.slug, body.slug)).limit(1),
					db.select().from(event).where(eq(event.id, body.slug)).limit(1),
				]);

				return response.json({
					available: !eventBySlug[0] && !eventById[0],
				});
			}
			case "user": {
				const [userBySlug, userById] = await Promise.all([
					db.select().from(user).where(eq(user.slug, body.slug)).limit(1),
					db.select().from(user).where(eq(user.id, body.slug)).limit(1),
				]);

				return response.json({
					available: !userBySlug[0] && !userById[0],
				});
			}
			default: {
				return response.error({ error: "Invalid type" }, 400);
			}
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Utils"],
			summary: "Validate slug availability",
			description: "Check if a slug is available for club, event, or user",
			body: validateSlugBodySchema,
			response: {
				200: z.object({
					available: z.boolean(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

utilsRouter.get(
	"/api/reviews",
	async ({ query, response }) => {
		const clubId = query?.clubId;
		const eventId = query?.eventId;
		const userId = query?.userId;

		const whereConditions = [];

		if (clubId) {
			whereConditions.push(and(eq(review.clubId, clubId), eq(review.type, "CLUB")));
		}

		if (eventId) {
			whereConditions.push(and(eq(review.eventId, eventId), eq(review.type, "EVENT")));
		}

		if (userId) {
			whereConditions.push(and(eq(review.userId, userId), eq(review.type, "USER")));
		}

		if (whereConditions.length === 0) {
			return response.error({ error: "clubId, eventId, or userId is required" }, 400);
		}

		const whereClause = or(...whereConditions);

		const reviews = await db.select().from(review).where(whereClause).orderBy(desc(review.createdAt));

		return response.json({
			reviews: reviews.map((r) => ({
				...r,
				content: r.content as z.infer<typeof baseReviewSchema>["content"],
			})),
		});
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
				400: z.object({ error: z.string() }),
			},
		},
	},
);

utilsRouter.get(
	"/api/reviews/:type/:id",
	async ({ params, response }) => {
		const { type, id } = params;

		if (!type || !id) {
			return response.error({ error: "Type and ID are required" }, 400);
		}

		let whereClause: ReturnType<typeof and> | undefined;

		switch (type) {
			case "club": {
				whereClause = and(eq(review.clubId, id), eq(review.type, "CLUB"));
				break;
			}
			case "event": {
				whereClause = and(eq(review.eventId, id), eq(review.type, "EVENT"));
				break;
			}
			case "user": {
				whereClause = and(eq(review.userId, id), eq(review.type, "USER"));
				break;
			}
			default: {
				return response.error({ error: "Invalid type. Must be club, event, or user" }, 400);
			}
		}

		const reviews = await db.select().from(review).where(whereClause).orderBy(desc(review.createdAt));

		return response.json({
			reviews: reviews.map((r) => ({
				...r,
				content: r.content as z.infer<typeof baseReviewSchema>["content"],
			})),
		});
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
				400: z.object({ error: z.string() }),
			},
		},
	},
);

utilsRouter.get(
	"/api/sitemap",
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
				slug: c.slug || c.id,
				updatedAt: c.updatedAt,
			})),
			events: events.map((e) => ({
				id: e.id,
				slug: e.slug || e.id,
				updatedAt: e.updatedAt,
			})),
			users: users.map((u) => ({
				id: u.id,
				slug: u.slug || u.id,
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
							slug: z.string(),
							updatedAt: z.string(),
						}),
					),
					events: z.array(
						z.object({
							id: z.string(),
							slug: z.string(),
							updatedAt: z.string(),
						}),
					),
					users: z.array(
						z.object({
							id: z.string(),
							slug: z.string(),
							updatedAt: z.string(),
						}),
					),
				}),
			},
		},
	},
);

export { utilsRouter };
