import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { club, clubMembership, event, post, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { Router } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const publicRouter = new Router();

const baseUserSchema = createSelectSchema(user);
const baseClubSchema = createSelectSchema(club);
const baseEventSchema = createSelectSchema(event);
const basePostSchema = createSelectSchema(post);
const baseClubMembershipSchema = createSelectSchema(clubMembership);

const publicUserSchema = baseUserSchema
	.pick({
		id: true,
		slug: true,
		name: true,
		bio: true,
		image: true,
		headerImage: true,
		location: true,
		website: true,
		callsign: true,
		isPrivate: true,
		isPrivateEmail: true,
		isPrivatePhone: true,
		isPrivateStats: true,
	})
	.extend({
		email: z.string().nullable(),
		phone: z.string().nullable(),
	});

publicRouter.get(
	"/api/public/clubs",
	async ({ query, response }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const clubsData = await db
			.select({
				id: club.id,
				name: club.name,
				slug: club.slug,
				description: club.description,
				logo: club.logo,
				verified: club.verified,
				location: club.location,
			})
			.from(club)
			.where(eq(club.isPrivate, false));

		const clubsWithMemberCounts = await Promise.all(
			clubsData.map(async (c) => {
				const memberCount = await db
					.select({ count: count() })
					.from(clubMembership)
					.where(eq(clubMembership.clubId, c.id));

				return {
					...c,
					member_count: Number(memberCount[0]?.count || 0),
				};
			}),
		);

		clubsWithMemberCounts.sort((a, b) => {
			if (a.verified !== b.verified) {
				return b.verified ? 1 : -1;
			}
			return b.member_count - a.member_count;
		});

		const paginatedClubs = clubsWithMemberCounts.slice(offset, offset + perPage);

		return response.json({
			clubs: paginatedClubs,
			pagination: {
				page,
				perPage,
				total: clubsWithMemberCounts.length,
				totalPages: Math.ceil(clubsWithMemberCounts.length / perPage),
			},
		});
	},
	{
		schema: {
			tags: ["Public"],
			summary: "List public clubs",
			description: "List public clubs with pagination, verified sorting, and member count",
			query: paginationQuerySchema,
			response: {
				200: z.object({
					clubs: z.array(
						baseClubSchema
							.pick({
								id: true,
								name: true,
								slug: true,
								description: true,
								logo: true,
								verified: true,
								location: true,
							})
							.extend({
								member_count: z.number(),
							}),
					),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

publicRouter.get(
	"/api/public/clubs/map",
	async ({ response }) => {
		const clubs = await db
			.select({
				id: club.id,
				name: club.name,
				slug: club.slug,
				logo: club.logo,
				latitude: club.latitude,
				longitude: club.longitude,
				location: club.location,
			})
			.from(club)
			.where(
				and(eq(club.isPrivate, false), sql`${club.latitude} IS NOT NULL`, sql`${club.longitude} IS NOT NULL`),
			);

		return response.json({ clubs });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get clubs for map",
			description: "Get public clubs with coordinates for map display",
			response: {
				200: z.object({
					clubs: z.array(
						baseClubSchema.pick({
							id: true,
							name: true,
							slug: true,
							logo: true,
							latitude: true,
							longitude: true,
							location: true,
						}),
					),
				}),
			},
		},
	},
);

publicRouter.get(
	"/api/public/clubs/:id",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db
			.select()
			.from(club)
			.where(and(or(eq(club.id, clubId), eq(club.slug, clubId)), eq(club.isPrivate, false)))
			.limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		const clubRecord = clubData[0];

		const memberCount = await db
			.select({ count: count() })
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubRecord.id));

		const isMember = context.user
			? await db
					.select()
					.from(clubMembership)
					.where(and(eq(clubMembership.clubId, clubRecord.id), eq(clubMembership.userId, context.user.id)))
					.limit(1)
					.then((result) => result.length > 0)
			: false;

		const postsWhere = isMember
			? eq(post.clubId, clubRecord.id)
			: and(eq(post.clubId, clubRecord.id), eq(post.isPublic, true));

		const postsData = await db.select().from(post).where(postsWhere).orderBy(desc(post.createdAt));

		const membersData = await db
			.select({
				id: clubMembership.id,
				userId: clubMembership.userId,
				role: clubMembership.role,
			})
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubRecord.id));

		const membersWithUsers = await Promise.all(
			membersData.map(async (m) => {
				const userData = await db
					.select({
						id: user.id,
						name: user.name,
						callsign: user.callsign,
						slug: user.slug,
						image: user.image,
						role: user.role,
					})
					.from(user)
					.where(eq(user.id, m.userId))
					.limit(1);

				return {
					...m,
					user: userData[0] || null,
				};
			}),
		);

		return response.json({
			...clubRecord,
			_count: {
				members: memberCount[0]?.count || 0,
			},
			posts: postsData,
			members: membersWithUsers,
		});
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get public club by ID or slug",
			description: "Get public club details with posts and members (privacy filtering applied)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseClubSchema.extend({
					_count: z.object({
						members: z.number(),
					}),
					posts: z.array(basePostSchema),
					members: z.array(
						baseClubMembershipSchema
							.pick({
								id: true,
								userId: true,
								role: true,
							})
							.extend({
								user: z
									.object({
										id: z.string(),
										name: z.string(),
										callsign: z.string().nullable(),
										slug: z.string().nullable(),
										image: z.string().nullable(),
										role: z.string().nullable(),
									})
									.nullable(),
							}),
					),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

publicRouter.get(
	"/api/public/clubs/map",
	async ({ response }) => {
		const clubs = await db
			.select({
				id: club.id,
				name: club.name,
				slug: club.slug,
				logo: club.logo,
				latitude: club.latitude,
				longitude: club.longitude,
				location: club.location,
			})
			.from(club)
			.where(
				and(eq(club.isPrivate, false), sql`${club.latitude} IS NOT NULL`, sql`${club.longitude} IS NOT NULL`),
			);

		return response.json({ clubs });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get clubs for map",
			description: "Get public clubs with coordinates for map display",
			response: {
				200: z.object({
					clubs: z.array(
						baseClubSchema.pick({
							id: true,
							name: true,
							slug: true,
							logo: true,
							latitude: true,
							longitude: true,
							location: true,
						}),
					),
				}),
			},
		},
	},
);

publicRouter.get(
	"/api/public/events",
	async ({ query, response, context }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const whereConditions = [eq(event.isPrivate, false)];

		if (context.user) {
			const userClubMemberships = await db
				.select({ clubId: clubMembership.clubId })
				.from(clubMembership)
				.where(eq(clubMembership.userId, context.user.id));

			const userClubIds = userClubMemberships.map((m) => m.clubId);

			if (userClubIds.length > 0) {
				const privacyCondition = or(eq(event.isPrivate, false), sql`${event.clubId} = ANY(${userClubIds})`);
				if (privacyCondition) {
					whereConditions.push(privacyCondition);
				}
			}
		}

		const where = and(...whereConditions);

		const events = await db
			.select()
			.from(event)
			.where(where)
			.orderBy(event.dateStart)
			.limit(perPage)
			.offset(offset);

		const total = await db.select({ count: count() }).from(event).where(where);

		return response.json({
			events: events.map((e) => ({
				...e,
				gearRequirements: e.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
				mapData: e.mapData as z.infer<typeof baseEventSchema>["mapData"],
			})),
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		schema: {
			tags: ["Public"],
			summary: "List public upcoming events",
			description: "List public upcoming events with pagination and privacy filtering",
			query: paginationQuerySchema,
			response: {
				200: z.object({
					events: z.array(baseEventSchema),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

publicRouter.get(
	"/api/public/events/:id",
	async ({ params, response, context }) => {
		const eventId = params.id;
		if (!eventId) {
			return response.error({ error: "Event ID is required" }, 400);
		}

		const eventData = await db
			.select()
			.from(event)
			.where(or(eq(event.id, eventId), eq(event.slug, eventId)))
			.limit(1);

		if (!eventData[0]) {
			return response.error({ error: "Event not found" }, 404);
		}

		const eventRecord = eventData[0];

		if (eventRecord.isPrivate && context.user) {
			const userMembership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, eventRecord.clubId), eq(clubMembership.userId, context.user.id)))
				.limit(1);

			if (!userMembership[0]) {
				return response.error({ error: "Event not found" }, 404);
			}
		} else if (eventRecord.isPrivate && !context.user) {
			return response.error({ error: "Event not found" }, 404);
		}

		const clubData = await db
			.select({
				id: club.id,
				name: club.name,
				slug: club.slug,
				logo: club.logo,
				verified: club.verified,
			})
			.from(club)
			.where(eq(club.id, eventRecord.clubId))
			.limit(1);

		return response.json({
			...eventRecord,
			gearRequirements: eventRecord.gearRequirements as z.infer<typeof baseEventSchema>["gearRequirements"],
			mapData: eventRecord.mapData as z.infer<typeof baseEventSchema>["mapData"],
			club: clubData[0] || null,
		});
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get public event by ID or slug",
			description: "Get public event details with privacy filtering",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseEventSchema.extend({
					club: z
						.object({
							id: z.string(),
							name: z.string(),
							slug: z.string().nullable(),
							logo: z.string().nullable(),
							verified: z.boolean(),
						})
						.nullable(),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

publicRouter.get(
	"/api/public/users",
	async ({ query, response }) => {
		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const orderBy = sql`CASE WHEN ${user.role} = 'admin' THEN 0 ELSE 1 END, ${user.name} ASC`;

		const users = await db
			.select({
				id: user.id,
				slug: user.slug,
				name: user.name,
				bio: user.bio,
				image: user.image,
				headerImage: user.headerImage,
				location: user.location,
				website: user.website,
				callsign: user.callsign,
				isPrivate: user.isPrivate,
				isPrivateEmail: user.isPrivateEmail,
				isPrivatePhone: user.isPrivatePhone,
				isPrivateStats: user.isPrivateStats,
				role: user.role,
				email: sql<string | null>`CASE WHEN ${user.isPrivateEmail} = false THEN ${user.email} ELSE NULL END`.as(
					"email",
				),
				phone: sql<string | null>`CASE WHEN ${user.isPrivatePhone} = false THEN ${user.phone} ELSE NULL END`.as(
					"phone",
				),
			})
			.from(user)
			.where(eq(user.isPrivate, false))
			.orderBy(orderBy)
			.limit(perPage)
			.offset(offset);

		const total = await db.select({ count: count() }).from(user).where(eq(user.isPrivate, false));

		return response.json({
			users,
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		schema: {
			tags: ["Public"],
			summary: "List public users",
			description: "List public users with pagination and admin priority sorting",
			query: paginationQuerySchema,
			response: {
				200: z.object({
					users: z.array(
						baseUserSchema
							.pick({
								id: true,
								slug: true,
								name: true,
								bio: true,
								image: true,
								headerImage: true,
								location: true,
								website: true,
								callsign: true,
								isPrivate: true,
								isPrivateEmail: true,
								isPrivatePhone: true,
								isPrivateStats: true,
								role: true,
							})
							.extend({
								email: z.string().nullable(),
								phone: z.string().nullable(),
							}),
					),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

publicRouter.get(
	"/api/public/users/:id",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const targetUser = await db
			.select({
				id: user.id,
				slug: user.slug,
				name: user.name,
				bio: user.bio,
				image: user.image,
				headerImage: user.headerImage,
				location: user.location,
				website: user.website,
				callsign: user.callsign,
				isPrivate: user.isPrivate,
				isPrivateEmail: user.isPrivateEmail,
				isPrivatePhone: user.isPrivatePhone,
				isPrivateStats: user.isPrivateStats,
				email:
					isAdmin || requestingUserId === userId
						? user.email
						: sql<
								string | null
							>`CASE WHEN ${user.isPrivateEmail} = false THEN ${user.email} ELSE NULL END`.as("email"),
				phone:
					isAdmin || requestingUserId === userId
						? user.phone
						: sql<
								string | null
							>`CASE WHEN ${user.isPrivatePhone} = false THEN ${user.phone} ELSE NULL END`.as("phone"),
			})
			.from(user)
			.where(and(or(eq(user.id, userId), eq(user.slug, userId)), eq(user.isPrivate, false)))
			.limit(1);

		if (targetUser.length === 0 || !targetUser[0]) {
			return response.error({ error: "User not found" }, 404);
		}

		const u = targetUser[0];

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
			memberships.map(async (membership) => {
				const clubData = await db
					.select({
						id: club.id,
						name: club.name,
						slug: club.slug,
						isPrivate: club.isPrivate,
					})
					.from(club)
					.where(eq(club.id, membership.clubId))
					.limit(1);
				const clubItem = clubData[0];
				if (!clubItem || clubItem.isPrivate) {
					return null;
				}
				return {
					...membership,
					club: clubItem,
				};
			}),
		);

		const filteredMemberships = membershipsWithClubs.filter((m) => m !== null);

		return response.json({
			...u,
			clubMembership: filteredMemberships,
		});
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get public user by ID or slug",
			description: "Get public user profile with filtered clubMembership and eventRegistration",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: publicUserSchema.extend({
					clubMembership: z.array(
						z.object({
							id: z.string(),
							userId: z.string(),
							clubId: z.string(),
							role: z.string(),
							club: z.object({
								id: z.string(),
								name: z.string(),
								slug: z.string().nullable(),
							}),
						}),
					),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

export { publicRouter };
