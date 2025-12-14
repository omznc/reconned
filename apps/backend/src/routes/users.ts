import { and, count, desc, eq, gte, ilike, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
	account,
	club,
	clubAuditLog,
	clubInvite,
	clubMembership,
	event,
	eventRegistration,
	review,
	user,
} from "../drizzle/schema";
import { db } from "../lib/db";
import { Router, responseSchema } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { getS3UploadUrl } from "../lib/storage";

// Base schemas generated from Drizzle tables
const baseUserSchema = createSelectSchema(user);
const baseClubMembershipSchema = createSelectSchema(clubMembership);
const baseClubSchema = createSelectSchema(club);
const baseEventSchema = createSelectSchema(event);
const baseEventRegistrationSchema = createSelectSchema(eventRegistration);
const baseClubInviteSchema = createSelectSchema(clubInvite);

// User schema with safe fields (email/phone may be null based on privacy)
const userSchema = baseUserSchema
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

// Club membership with club details (for dashboard)
const clubMembershipWithClubSchema = baseClubMembershipSchema.extend({
	club: baseClubSchema
		.extend({
			_count: z.object({
				members: z.number(),
				events: z.number(),
				reviews: z.number(),
			}),
			events: z.array(
				baseEventSchema.pick({
					id: true,
					name: true,
					dateStart: true,
				}),
			),
			reviews: z.array(
				createSelectSchema(review).pick({
					content: true,
				}),
			),
		})
		.nullable(),
});

// Event registration with event details (used in multiple places)
const eventRegistrationWithEventSchema = baseEventRegistrationSchema.extend({
	event: baseEventSchema
		.pick({
			id: true,
			name: true,
			slug: true,
			dateStart: true,
		})
		.nullable(),
});

// User with relations (for authenticated endpoints - used in multiple places)
const userWithRelationsSchema = userSchema.extend({
	clubMembership: z.array(clubMembershipWithClubSchema),
	eventRegistration: z.array(eventRegistrationWithEventSchema),
});

// getRequestingUserInfo removed - use context.user?.id and context.isAdmin directly

function selectSafeUserFields(requestingUserId?: string, isAdmin?: boolean, targetUserId?: string) {
	const isSelf = requestingUserId && targetUserId && requestingUserId === targetUserId;
	const canSeeAll = isAdmin || isSelf;

	if (canSeeAll) {
		return {
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
			email: user.email,
			phone: user.phone,
		};
	}

	return {
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
		email: sql<string | null>`CASE WHEN ${user.isPrivateEmail} = false THEN ${user.email} ELSE NULL END`.as(
			"email",
		),
		phone: sql<string | null>`CASE WHEN ${user.isPrivatePhone} = false THEN ${user.phone} ELSE NULL END`.as(
			"phone",
		),
	};
}

export const usersRouter = new Router();

usersRouter.get(
	"/api/users/:id",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const targetUser = await db
			.select(selectSafeUserFields(requestingUserId, isAdmin, userId))
			.from(user)
			.where(or(eq(user.id, userId), eq(user.slug, userId)))
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
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, u.id));

		const membershipsWithClubs = await Promise.all(
			memberships.map(async (membership) => {
				const clubData = await db.select().from(club).where(eq(club.id, membership.clubId)).limit(1);
				const clubItem = clubData[0];
				if (!clubItem) {
					return { ...membership, club: null };
				}

				// Get counts
				const memberCount = await db
					.select({ count: count() })
					.from(clubMembership)
					.where(eq(clubMembership.clubId, membership.clubId));
				const eventCount = await db
					.select({ count: count() })
					.from(event)
					.where(eq(event.clubId, membership.clubId));
				const reviewCount = await db
					.select({ count: count() })
					.from(review)
					.where(eq(review.clubId, membership.clubId));

				// Get next event
				const nextEvents = await db
					.select({
						id: event.id,
						name: event.name,
						dateStart: event.dateStart,
					})
					.from(event)
					.where(and(eq(event.clubId, membership.clubId), gte(event.dateStart, new Date().toISOString())))
					.orderBy(event.dateStart)
					.limit(1);

				// Get latest review
				const latestReviews = await db
					.select({
						content: review.content,
					})
					.from(review)
					.where(eq(review.clubId, membership.clubId))
					.orderBy(desc(review.createdAt))
					.limit(1);

				return {
					...membership,
					club: {
						...clubItem,
						_count: {
							members: memberCount[0]?.count || 0,
							events: eventCount[0]?.count || 0,
							reviews: reviewCount[0]?.count || 0,
						},
						events: nextEvents,
						reviews: latestReviews,
					},
				};
			}),
		);

		const registrations = await db
			.select({
				id: eventRegistration.id,
				eventId: eventRegistration.eventId,
				createdById: eventRegistration.createdById,
				type: eventRegistration.type,
				paymentMethod: eventRegistration.paymentMethod,
				attended: eventRegistration.attended,
				createdAt: eventRegistration.createdAt,
				updatedAt: eventRegistration.updatedAt,
			})
			.from(eventRegistration)
			.where(eq(eventRegistration.createdById, u.id));

		const registrationsWithEvents = await Promise.all(
			registrations.map(async (registration) => {
				const eventData = await db
					.select({
						id: event.id,
						name: event.name,
						slug: event.slug,
						dateStart: event.dateStart,
					})
					.from(event)
					.where(eq(event.id, registration.eventId))
					.limit(1);
				return {
					...registration,
					event: eventData[0] || null,
				};
			}),
		);

		return response.json({
			...u,
			clubMembership: membershipsWithClubs,
			eventRegistration: registrationsWithEvents,
		});
	},
	{
		schema: {
			tags: ["Users"],
			summary: "Get user by ID",
			description: "Returns a user by their ID or slug, including club memberships and event registrations",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: userWithRelationsSchema,
				404: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.get(
	"/api/users",
	async ({ query, response, context, validatedQuery }) => {
		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const { page, perPage } = validatedQuery || {
			page: Number.parseInt(query.get("page") || "1", 10),
			perPage: Number.parseInt(query.get("perPage") || "20", 10),
		};
		const offset = (page - 1) * perPage;

		let orderBy = sql`${user.name} ASC`;
		if (query.get("sort") === "admin") {
			orderBy = sql`CASE WHEN ${user.role} = 'admin' THEN 0 ELSE 1 END, ${user.name} ASC`;
		}

		const whereConditions = [];
		const search = query.get("search");
		if (search) {
			whereConditions.push(
				or(
					ilike(user.name, `%${search}%`),
					ilike(user.email, `%${search}%`),
					ilike(user.callsign, `%${search}%`),
				),
			);
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

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
				email: isAdmin
					? user.email
					: requestingUserId
						? sql<
								string | null
							>`CASE WHEN ${user.id} = ${requestingUserId} OR ${user.isPrivateEmail} = false THEN ${user.email} ELSE NULL END`.as(
								"email",
							)
						: sql<
								string | null
							>`CASE WHEN ${user.isPrivateEmail} = false THEN ${user.email} ELSE NULL END`.as("email"),
				phone: isAdmin
					? user.phone
					: requestingUserId
						? sql<
								string | null
							>`CASE WHEN ${user.id} = ${requestingUserId} OR ${user.isPrivatePhone} = false THEN ${user.phone} ELSE NULL END`.as(
								"phone",
							)
						: sql<
								string | null
							>`CASE WHEN ${user.isPrivatePhone} = false THEN ${user.phone} ELSE NULL END`.as("phone"),
			})
			.from(user)
			.where(where)
			.orderBy(orderBy)
			.limit(perPage)
			.offset(offset);

		const total = await db.select({ count: count() }).from(user).where(where);

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
			tags: ["Users"],
			summary: "List users",
			description: "Returns a paginated list of users with optional search and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sort: z.enum(["admin"]).optional(),
			}),
			response: {
				200: z.object({
					users: z.array(userSchema),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

usersRouter.get(
	"/api/users/:id/profile",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const targetUser = await db
			.select(selectSafeUserFields(requestingUserId, isAdmin, userId))
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
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, u.id));

		// Get club details for memberships and filter out private clubs
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

		// Filter out null memberships (private clubs)
		const filteredMemberships = membershipsWithClubs.filter((m) => m !== null);

		const registrations = await db
			.select({
				id: eventRegistration.id,
				eventId: eventRegistration.eventId,
				createdById: eventRegistration.createdById,
				type: eventRegistration.type,
				paymentMethod: eventRegistration.paymentMethod,
				attended: eventRegistration.attended,
				createdAt: eventRegistration.createdAt,
				updatedAt: eventRegistration.updatedAt,
			})
			.from(eventRegistration)
			.where(eq(eventRegistration.createdById, u.id));

		// Get event details and filter out private events/clubs
		const registrationsWithEvents = await Promise.all(
			registrations.map(async (registration) => {
				const eventData = await db
					.select({
						id: event.id,
						name: event.name,
						slug: event.slug,
						isPrivate: event.isPrivate,
						clubId: event.clubId,
					})
					.from(event)
					.where(eq(event.id, registration.eventId))
					.limit(1);
				const eventItem = eventData[0];
				if (!eventItem) {
					return null;
				}

				// Check if club is private
				const clubData = await db
					.select({
						isPrivate: club.isPrivate,
					})
					.from(club)
					.where(eq(club.id, eventItem.clubId))
					.limit(1);
				const clubItem = clubData[0];

				if (eventItem.isPrivate || clubItem?.isPrivate) {
					return null;
				}

				return {
					...registration,
					event: {
						...eventItem,
						club: {
							id: eventItem.clubId,
							isPrivate: clubItem?.isPrivate || false,
						},
					},
				};
			}),
		);

		// Filter out null registrations (private events/clubs)
		const filteredRegistrations = registrationsWithEvents.filter((r) => r !== null);

		return response.json({
			...u,
			clubMembership: filteredMemberships,
			eventRegistration: filteredRegistrations,
		});
	},
	{
		schema: {
			tags: ["Users"],
			summary: "Get user profile",
			description: "Returns a public user profile by ID or slug",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: userSchema.extend({
					clubMembership: z.array(
						baseClubMembershipSchema.extend({
							club: baseClubSchema.pick({
								id: true,
								name: true,
								slug: true,
							}),
						}),
					),
					eventRegistration: z.array(
						baseEventRegistrationSchema.extend({
							event: baseEventSchema
								.pick({
									id: true,
									name: true,
									slug: true,
									dateStart: true,
								})
								.extend({
									club: z.object({
										id: z.string(),
										isPrivate: z.boolean(),
									}),
								}),
						}),
					),
				}),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.put(
	"/api/users/:id",
	async ({ params, response, context, validatedBody }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as {
			name?: string;
			bio?: string;
			website?: string;
			location?: string;
			phone?: string;
			slug?: string;
			callsign?: string;
			isPrivate?: boolean;
			isPrivateEmail?: boolean;
			isPrivatePhone?: boolean;
			isPrivateStats?: boolean;
			image?: string;
			headerImage?: string;
		};

		const updateData: Record<string, unknown> = {
			updatedAt: new Date().toISOString(),
		};

		if (body.name !== undefined) {
			updateData.name = body.name;
		}
		if (body.bio !== undefined) {
			updateData.bio = body.bio;
		}
		if (body.website !== undefined) {
			updateData.website = body.website;
		}
		if (body.location !== undefined) {
			updateData.location = body.location;
		}
		if (body.phone !== undefined) {
			updateData.phone = body.phone;
		}
		if (body.slug !== undefined) {
			updateData.slug = body.slug || null;
		}
		if (body.callsign !== undefined) {
			updateData.callsign = body.callsign;
		}
		if (body.isPrivate !== undefined) {
			updateData.isPrivate = body.isPrivate;
		}
		if (body.isPrivateEmail !== undefined) {
			updateData.isPrivateEmail = body.isPrivateEmail;
		}
		if (body.isPrivatePhone !== undefined) {
			updateData.isPrivatePhone = body.isPrivatePhone;
		}
		if (body.isPrivateStats !== undefined) {
			updateData.isPrivateStats = body.isPrivateStats;
		}
		if (body.image !== undefined) {
			updateData.image = body.image || null;
		}
		if (body.headerImage !== undefined) {
			updateData.headerImage = body.headerImage || null;
		}

		await db.update(user).set(updateData).where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Update user",
			description: "Update user information",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				name: z.string().min(1).max(50).optional(),
				bio: z.string().max(200).optional(),
				website: z.string().url().optional(),
				location: z.string().optional(),
				phone: z.string().optional(),
				slug: z.string().optional(),
				callsign: z.string().optional(),
				isPrivate: z.boolean().optional(),
				isPrivateEmail: z.boolean().optional(),
				isPrivatePhone: z.boolean().optional(),
				isPrivateStats: z.boolean().optional(),
				image: z.string().optional(),
				headerImage: z.string().optional(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.delete(
	"/api/users/:id/image",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		await db
			.update(user)
			.set({
				image: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Delete user image",
			description: "Delete the user's profile image",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.delete(
	"/api/users/:id/header-image",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		await db
			.update(user)
			.set({
				headerImage: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Delete user header image",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
			},
		},
	},
);

usersRouter.get(
	"/api/users/:id/stats",
	async ({ params, response }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		const eventRegCount = await db
			.select({ count: count() })
			.from(eventRegistration)
			.where(eq(eventRegistration.createdById, userId));

		const membershipCount = await db
			.select({ count: count() })
			.from(clubMembership)
			.where(eq(clubMembership.userId, userId));

		const reviewsWrittenCount = await db.select({ count: count() }).from(review).where(eq(review.authorId, userId));

		const reviewsReceivedCount = await db.select({ count: count() }).from(review).where(eq(review.userId, userId));

		// Get club memberships with club details
		const memberships = await db
			.select({
				id: clubMembership.id,
				userId: clubMembership.userId,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, userId));

		const membershipsWithClubs = await Promise.all(
			memberships.map(async (membership) => {
				const clubData = await db.select().from(club).where(eq(club.id, membership.clubId)).limit(1);
				const clubItem = clubData[0];
				if (!clubItem) {
					return { ...membership, club: null };
				}

				// Get counts
				const memberCount = await db
					.select({ count: count() })
					.from(clubMembership)
					.where(eq(clubMembership.clubId, membership.clubId));
				const eventCount = await db
					.select({ count: count() })
					.from(event)
					.where(eq(event.clubId, membership.clubId));
				const reviewCount = await db
					.select({ count: count() })
					.from(review)
					.where(eq(review.clubId, membership.clubId));

				// Get next event
				const nextEvents = await db
					.select({
						id: event.id,
						name: event.name,
						dateStart: event.dateStart,
					})
					.from(event)
					.where(and(eq(event.clubId, membership.clubId), gte(event.dateStart, new Date().toISOString())))
					.orderBy(event.dateStart)
					.limit(1);

				// Get latest review
				const latestReviews = await db
					.select({
						content: review.content,
					})
					.from(review)
					.where(eq(review.clubId, membership.clubId))
					.orderBy(desc(review.createdAt))
					.limit(1);

				return {
					...membership,
					club: {
						...clubItem,
						_count: {
							members: memberCount[0]?.count || 0,
							events: eventCount[0]?.count || 0,
							reviews: reviewCount[0]?.count || 0,
						},
						events: nextEvents,
						reviews: latestReviews,
					},
				};
			}),
		);

		// Get event registrations with event details
		const registrations = await db
			.select({
				id: eventRegistration.id,
				eventId: eventRegistration.eventId,
				createdById: eventRegistration.createdById,
				type: eventRegistration.type,
				paymentMethod: eventRegistration.paymentMethod,
				attended: eventRegistration.attended,
				createdAt: eventRegistration.createdAt,
				updatedAt: eventRegistration.updatedAt,
			})
			.from(eventRegistration)
			.where(eq(eventRegistration.createdById, userId))
			.orderBy(eventRegistration.createdAt)
			.limit(5);

		const registrationsWithEvents = await Promise.all(
			registrations.map(async (registration) => {
				const eventData = await db
					.select({
						id: event.id,
						name: event.name,
						slug: event.slug,
						dateStart: event.dateStart,
					})
					.from(event)
					.where(eq(event.id, registration.eventId))
					.limit(1);
				return {
					...registration,
					event: eventData[0] || null,
				};
			}),
		);

		return response.json({
			eventRegistration: eventRegCount[0]?.count || 0,
			clubMembership: membershipCount[0]?.count || 0,
			reviewsWritten: reviewsWrittenCount[0]?.count || 0,
			reviewsReceived: reviewsReceivedCount[0]?.count || 0,
			clubMembershipDetails: membershipsWithClubs,
			eventRegistrationDetails: registrationsWithEvents,
		});
	},
	{
		schema: {
			tags: ["Users"],
			summary: "Get user statistics",
			description: "Returns statistics for a user",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					eventRegistration: z.number(),
					clubMembership: z.number(),
					reviewsWritten: z.number(),
					reviewsReceived: z.number(),
					clubMembershipDetails: z.array(clubMembershipWithClubSchema),
					eventRegistrationDetails: z.array(eventRegistrationWithEventSchema),
				}),
			},
		},
	},
);

usersRouter.get(
	"/api/users/:id/account",
	async ({ params, response }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		const userAccount = await db.select().from(account).where(eq(account.userId, userId)).limit(1);

		return response.json({
			hasPassword: userAccount.length > 0 && userAccount[0]?.password !== null,
		});
	},
	{
		schema: {
			tags: ["Users"],
			summary: "Get user account info",
			description: "Returns account information for a user",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					hasPassword: z.boolean(),
				}),
			},
		},
	},
);

usersRouter.put(
	"/api/users/:id/theme",
	async ({ params, response, context, validatedBody }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as { theme: string };

		await db
			.update(user)
			.set({
				theme: body.theme,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Update user theme",
			description: "Update the user's theme preference",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				theme: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.put(
	"/api/users/:id/font",
	async ({ params, response, context, validatedBody }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as { font: string };

		await db
			.update(user)
			.set({
				font: body.font,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Update user font",
			description: "Update the user's font preference",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				font: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.put(
	"/api/users/:id/style",
	async ({ params, response, context, validatedBody }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as { style: string };

		await db
			.update(user)
			.set({
				style: body.style,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Update user style",
			description: "Update the user's style preference",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				style: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.get(
	"/api/users/invites",
	async ({ context, response }) => {
		if (!context.user) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const invites = await db
			.select()
			.from(clubInvite)
			.where(and(eq(clubInvite.email, context.user.email), eq(clubInvite.status, "PENDING")));

		return response.json({ invites });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Get pending invites",
			description: "Returns a list of pending club invites for the current user",
			response: {
				200: z.object({
					invites: z.array(
						baseClubInviteSchema.extend({
							club: baseClubSchema,
						}),
					),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.get(
	"/api/users/invites/count",
	async ({ context, response }) => {
		if (!context.user) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const result = await db
			.select({ count: count() })
			.from(clubInvite)
			.where(and(eq(clubInvite.email, context.user.email), eq(clubInvite.status, "PENDING")));

		return response.json({ count: result[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Get pending invites count",
			description: "Returns the count of pending club invites for the current user",
			response: {
				200: z.object({
					count: z.number(),
				}),
			},
		},
	},
);

usersRouter.post(
	"/api/users/:id/image/upload-url",
	async ({ params, response, context, validatedBody }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as { type: string; size: number };

		try {
			const result = await getS3UploadUrl(`user/${userId}/image`, body.type, body.size);
			return response.json(result);
		} catch (error) {
			return response.error(error instanceof Error ? error.message : "Failed to generate upload URL", 400);
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Get user avatar upload URL",
			description: "Get a presigned S3 URL for uploading a user avatar image",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				type: z.string(),
				size: z.number(),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.post(
	"/api/users/:id/header-image/upload-url",
	async ({ params, response, context, validatedBody }) => {
		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const body = validatedBody as { type: string; size: number };

		try {
			const result = await getS3UploadUrl(`user/${userId}/header`, body.type, body.size);
			return response.json(result);
		} catch (error) {
			return response.error(error instanceof Error ? error.message : "Failed to generate upload URL", 400);
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Get user header image upload URL",
			description: "Get a presigned S3 URL for uploading a user header image",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				type: z.string(),
				size: z.number(),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.get(
	"/api/users/:id/daily-quota",
	async ({ params, response, context }) => {
		const userId = params.id;

		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		if (!context.user || context.user.id !== userId) {
			return response.error({ error: "Unauthorized" }, 401);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		const todayUploads = await db
			.select({ count: count() })
			.from(clubAuditLog)
			.where(
				and(
					eq(clubAuditLog.userId, userId),
					sql`${clubAuditLog.actionType} IN ('POST_CREATE', 'SPENDING_CREATE')`,
					sql`${clubAuditLog.createdAt} >= ${today.toISOString()}`,
					sql`${clubAuditLog.createdAt} < ${tomorrow.toISOString()}`,
				),
			);

		const USER_DAILY_LIMIT = 50 * 1024 * 1024;
		const estimatedDailyUsage = (todayUploads[0]?.count || 0) * 2 * 1024 * 1024;
		const remaining = Math.max(0, USER_DAILY_LIMIT - estimatedDailyUsage);

		return response.json({
			currentUsage: estimatedDailyUsage,
			limit: USER_DAILY_LIMIT,
			remaining,
			allowed: estimatedDailyUsage < USER_DAILY_LIMIT,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Get user daily upload quota",
			description: "Check user daily upload quota based on audit logs",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					currentUsage: z.number(),
					limit: z.number(),
					remaining: z.number(),
					allowed: z.boolean(),
				}),
				...responseSchema([400, 401], z.object({ error: z.string() })),
			},
		},
	},
);
