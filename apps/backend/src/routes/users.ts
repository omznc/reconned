import bcrypt from "bcrypt";
import { and, count, eq, getTableColumns, ilike, ne, or, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import {
	account,
	club,
	clubAuditLog,
	clubInvite,
	clubMembership,
	event,
	eventRegistration,
	user,
} from "../drizzle/schema";
import { logClubAudit } from "../lib/audit-logger";
import { db } from "../lib/db";
import { apiError } from "../lib/errors";
import { posthog } from "../lib/posthog";
import { Router, responseSchema } from "../lib/router";
import { httpsUrl, paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";
import { getS3UploadUrl } from "../lib/storage";
import { Sanitize } from "../lib/user-sanitization";

// Base schemas generated from Drizzle tables
const baseUserSchema = createSelectSchema(user);
const baseClubMembershipSchema = createSelectSchema(clubMembership);
const baseClubSchema = createSelectSchema(club);
const baseEventSchema = createSelectSchema(event);
const baseEventRegistrationSchema = createSelectSchema(eventRegistration);
const baseClubInviteSchema = createSelectSchema(clubInvite);

const publicClubSchema = baseClubSchema.omit({
	instagramAccessToken: true,
	instagramRefreshToken: true,
	instagramTokenExpiry: true,
	facebookPageId: true,
});

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
		language: true,
	})
	.extend({
		email: z.string().nullable(),
		phone: z.string().nullable(),
		clubMembership: z
			.array(
				z.object({
					id: z.string(),
					clubId: z.string(),
					role: z.string(),
					club: z.object({
						id: z.string(),
						name: z.string(),
					}),
				}),
			)
			.optional(),
	});

// Club membership with club details (for dashboard)
const clubMembershipWithClubSchema = baseClubMembershipSchema.extend({
	club: baseClubSchema
		.pick({
			id: true,
			name: true,
			slug: true,
			description: true,
			logo: true,
			location: true,
			website: true,
			isPrivate: true,
			verified: true,
			createdAt: true,
		})
		.extend({
			_count: z.object({
				members: z.number(),
				events: z.number(),
				reviews: z.number(),
			}),
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
		.extend({
			dateStart: z.string().nullable(), // Allow null for LEFT JOIN results
		})
		.nullable(),
});

// User with relations (for authenticated endpoints - used in multiple places)
const userWithRelationsSchema = userSchema.extend({
	clubMembership: z.array(clubMembershipWithClubSchema),
	eventRegistration: z.array(eventRegistrationWithEventSchema),
});

// getRequestingUserInfo removed - use context.user?.id and context.isAdmin directly

function getSafeUserSelect(requestingUserId?: string, isAdmin?: boolean, targetUserId?: string) {
	// Get all user columns except sensitive ones that should never be exposed
	const {
		emailVerified: _emailVerified,
		normalizedEmail: _normalizedEmail,
		role: _role,
		banned: _banned,
		banReason: _banReason,
		banExpires: _banExpires,
		twoFactorEnabled: _twoFactorEnabled,
		...safeColumns
	} = getTableColumns(user);

	const sanitize = new Sanitize({
		requestingUserId,
		targetUserId,
		isAdmin,
	});

	// Apply sanitization to privacy-controlled fields
	return {
		...safeColumns,
		email: sanitize.field<string | null>(user.email, user.isPrivateEmail),
		phone: sanitize.field<string | null>(user.phone, user.isPrivatePhone),
	};
}

export const usersRouter = new Router();

usersRouter.get(
	"/users/:id",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const targetUser = await db
			.select({
				...getSafeUserSelect(requestingUserId, isAdmin, userId),
			})
			.from(user)
			.where(or(eq(user.id, userId), eq(user.slug, userId)))
			.limit(1);

		if (targetUser.length === 0 || !targetUser[0]) {
			throw apiError.notFound("User not found");
		}

		const u = targetUser[0];

		const isSelf = requestingUserId && u.id === requestingUserId;
		if (u.isPrivate && !isAdmin && !isSelf) {
			throw apiError.notFound("User not found");
		}

		// Single optimized query with JOINs and aggregate counts
		const membershipsWithClubs = await db
			.select({
				// Membership fields
				id: clubMembership.id,
				userId: clubMembership.userId,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
				// Club fields
				clubName: club.name,
				clubSlug: club.slug,
				clubDescription: club.description,
				clubLogo: club.logo,
				clubLocation: club.location,
				clubWebsite: club.website,
				clubIsPrivate: club.isPrivate,
				clubVerified: club.verified,
				clubCreatedAt: club.createdAt,
				// Aggregate counts using subqueries
				memberCount: sql<number>`(
					SELECT COUNT(*)
					FROM "ClubMembership" cm
					WHERE cm."clubId" = "ClubMembership"."clubId"
				)`,
				eventCount: sql<number>`(
					SELECT COUNT(*)
					FROM "Event" e
					WHERE e."clubId" = "ClubMembership"."clubId"
				)`,
				reviewCount: sql<number>`(
					SELECT COUNT(*)
					FROM "Review" r
					WHERE r."clubId" = "ClubMembership"."clubId"
				)`,
			})
			.from(clubMembership)
			.innerJoin(club, eq(clubMembership.clubId, club.id))
			.where(eq(clubMembership.userId, u.id));

		// Transform flat results into nested structure
		const formattedMemberships = membershipsWithClubs.map((m) => ({
			id: m.id,
			userId: m.userId,
			clubId: m.clubId,
			role: m.role,
			startDate: m.startDate,
			endDate: m.endDate,
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
			club: {
				id: m.clubId,
				name: m.clubName,
				slug: m.clubSlug,
				description: m.clubDescription,
				logo: m.clubLogo,
				location: m.clubLocation,
				website: m.clubWebsite,
				isPrivate: m.clubIsPrivate,
				verified: m.clubVerified,
				createdAt: m.clubCreatedAt,
				_count: {
					members: Number(m.memberCount),
					events: Number(m.eventCount),
					reviews: Number(m.reviewCount),
				},
			},
		}));

		// Single optimized query for registrations with event data
		const registrationsWithEvents = await db
			.select({
				// Registration fields
				id: eventRegistration.id,
				eventId: eventRegistration.eventId,
				createdById: eventRegistration.createdById,
				type: eventRegistration.type,
				paymentMethod: eventRegistration.paymentMethod,
				attended: eventRegistration.attended,
				createdAt: eventRegistration.createdAt,
				updatedAt: eventRegistration.updatedAt,
				// Event fields
				eventName: event.name,
				eventSlug: event.slug,
				eventDateStart: event.dateStart,
			})
			.from(eventRegistration)
			.leftJoin(event, eq(eventRegistration.eventId, event.id))
			.where(eq(eventRegistration.createdById, u.id));

		// Transform flat results into nested structure
		const formattedRegistrations = registrationsWithEvents.map((r) => ({
			id: r.id,
			eventId: r.eventId,
			createdById: r.createdById,
			type: r.type,
			paymentMethod: r.paymentMethod,
			attended: r.attended,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
			event: r.eventName
				? {
						id: r.eventId,
						name: r.eventName,
						slug: r.eventSlug,
						dateStart: r.eventDateStart,
					}
				: null,
		}));

		return response.json({
			...u,
			clubMembership: formattedMemberships,
			eventRegistration: formattedRegistrations,
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
	"/users",
	async ({ response, context, query }) => {
		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		let orderBy = sql`${user.name} ASC`;
		if (query?.sort === "admin") {
			orderBy = sql`CASE WHEN ${user.role} = 'admin' THEN 0 ELSE 1 END, ${user.name} ASC`;
		}

		const whereConditions = [];
		const search = query?.search;
		if (search) {
			whereConditions.push(
				or(
					ilike(user.name, `%${search}%`),
					ilike(user.email, `%${search}%`),
					ilike(user.callsign, `%${search}%`),
				),
			);
		}

		if (!isAdmin) {
			if (requestingUserId) {
				whereConditions.push(or(eq(user.isPrivate, false), eq(user.id, requestingUserId)));
			} else {
				whereConditions.push(eq(user.isPrivate, false));
			}
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const usersWithMemberships = await db
			.select({
				// User fields
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
				language: user.language,
				role: user.role,
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
				// Club membership fields (will be null if no membership)
				membershipId: clubMembership.id,
				membershipClubId: clubMembership.clubId,
				membershipClubName: club.name,
				membershipRole: clubMembership.role,
			})
			.from(user)
			.leftJoin(
				clubMembership,
				and(
					eq(clubMembership.userId, user.id),
					eq(clubMembership.role, "USER"), // Only show regular memberships, not management roles
				),
			)
			.leftJoin(club, eq(clubMembership.clubId, club.id))
			.where(where)
			.orderBy(orderBy)
			.limit(perPage)
			.offset(offset);

		const total = await db.select({ count: count() }).from(user).where(where);

		// Group memberships by user
		const userMap = new Map<
			string,
			{
				id: string;
				slug: string | null;
				name: string;
				bio: string | null;
				image: string | null;
				headerImage: string | null;
				location: string | null;
				website: string | null;
				callsign: string | null;
				isPrivate: boolean;
				isPrivateEmail: boolean;
				isPrivatePhone: boolean;
				isPrivateStats: boolean;
				language: string;
				role: string | null;
				email: string | null;
				phone: string | null;
				clubMembership: Array<{
					id: string;
					clubId: string;
					role: string;
					club: { id: string; name: string };
				}>;
				isAdmin: boolean;
			}
		>();

		for (const row of usersWithMemberships) {
			const userId = row.id;
			if (!userMap.has(userId)) {
				userMap.set(userId, {
					id: row.id,
					slug: row.slug,
					name: row.name,
					bio: row.bio,
					image: row.image,
					headerImage: row.headerImage,
					location: row.location,
					website: row.website,
					callsign: row.callsign,
					isPrivate: row.isPrivate,
					isPrivateEmail: row.isPrivateEmail,
					isPrivatePhone: row.isPrivatePhone,
					isPrivateStats: row.isPrivateStats,
					language: row.language || "en",
					role: row.role,
					email: row.email,
					phone: row.phone,
					clubMembership: [],
					isAdmin: row.role?.toUpperCase() === "ADMIN",
				});
			}

			const user = userMap.get(userId);
			if (!user) continue;

			// Add membership if it exists
			if (row.membershipId && row.membershipClubId && row.membershipClubName) {
				user.clubMembership.push({
					id: row.membershipId,
					clubId: row.membershipClubId,
					role: row.membershipRole || "USER",
					club: {
						id: row.membershipClubId,
						name: row.membershipClubName,
					},
				});
			}
		}

		return response.json({
			users: Array.from(userMap.values()),
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
				search: z.string().max(100).optional(),
				sort: z.enum(["admin"]).optional(),
			}),
			response: {
				200: z.object({
					users: z.array(
						userSchema.extend({
							isAdmin: z.boolean(),
						}),
					),
					pagination: paginationResponseSchema,
				}),
			},
		},
	},
);

usersRouter.get(
	"/users/:id/profile",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const targetUser = await db
			.select(getSafeUserSelect(requestingUserId, isAdmin, userId))
			.from(user)
			.where(and(or(eq(user.id, userId), eq(user.slug, userId)), eq(user.isPrivate, false)))
			.limit(1);

		if (targetUser.length === 0 || !targetUser[0]) {
			throw apiError.notFound("User not found");
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
						logo: club.logo,
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
						dateStart: event.dateStart,
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
						id: eventItem.id,
						name: eventItem.name,
						slug: eventItem.slug,
						dateStart: eventItem.dateStart,
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
								logo: true,
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

async function validateUserSlug(slug: string, excludeUserId?: string): Promise<boolean> {
	const [userBySlug, userById] = await Promise.all([
		db.select().from(user).where(eq(user.slug, slug)).limit(1),
		db.select().from(user).where(eq(user.id, slug)).limit(1),
	]);

	if (excludeUserId) {
		return !(userBySlug[0] && userBySlug[0].id !== excludeUserId) && !userById[0];
	}

	return !userBySlug[0] && !userById[0];
}

usersRouter.put(
	"/users/:id",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

		// Fetch existing user data for validation checks
		const existingUserData = await db.select({ slug: user.slug }).from(user).where(eq(user.id, userId)).limit(1);

		if (!existingUserData[0]) {
			throw apiError.validation("User not found");
		}

		// Validate slug only if it's being changed
		if (body.slug && body.slug !== existingUserData[0].slug) {
			const valid = await validateUserSlug(body.slug, userId);
			if (!valid) {
				throw apiError.validation("Slug is already taken");
			}
		}

		// Filter out undefined values and handle empty strings
		const updateData = Object.fromEntries(
			Object.entries(body)
				.filter(([_, value]) => value !== undefined)
				.map(([key, value]) => [
					key,
					(key === "website" || key === "slug" || key === "image" || key === "headerImage") && value === ""
						? null
						: value,
				]),
		);

		// Always update timestamp
		updateData.updatedAt = new Date().toISOString();

		await db.update(user).set(updateData).where(eq(user.id, userId));

		// Track user profile update
		const updatedFields = Object.keys(updateData).filter((key) => key !== "updatedAt");
		if (updatedFields.length > 0) {
			posthog.capture({
				distinctId: userId,
				event: "user_profile_updated",
				properties: {
					updated_fields: updatedFields,
					fields_count: updatedFields.length,
					has_bio: body.bio !== undefined,
					has_website: body.website !== undefined,
					has_location: body.location !== undefined,
					has_image: body.image !== undefined,
					has_header_image: body.headerImage !== undefined,
					privacy_updated:
						body.isPrivate !== undefined ||
						body.isPrivateEmail !== undefined ||
						body.isPrivatePhone !== undefined ||
						body.isPrivateStats !== undefined,
				},
			});
		}

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
				website: httpsUrl.optional(),
				location: z.string().max(100).optional(),
				phone: z.string().max(20).optional(),
				slug: z.string().max(50).optional(),
				callsign: z.string().max(50).optional(),
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
	"/users/:id/image",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
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
	"/users/:id/header-image",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
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
	"/users/:id/stats",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		const requestingUserId = context.user?.id;
		const isAdmin = context.isAdmin;

		const targetUser = await db
			.select({
				id: user.id,
				isPrivateStats: user.isPrivateStats,
			})
			.from(user)
			.where(or(eq(user.id, userId), eq(user.slug, userId)))
			.limit(1);

		if (!targetUser[0]) {
			throw apiError.notFound("User not found");
		}

		const isSelf = requestingUserId && targetUser[0].id === requestingUserId;
		if (targetUser[0].isPrivateStats && !isAdmin && !isSelf) {
			throw apiError.notFound("User not found");
		}

		// Single optimized query to get all user stats and club memberships with aggregated data
		const userStats = await db
			.select({
				// User stats counts
				eventRegCount: sql<number>`(
					SELECT COUNT(*)
					FROM "EventRegistration" er
					WHERE er."createdById" = ${userId}
				)`,
				membershipCount: sql<number>`(
					SELECT COUNT(*)
					FROM "ClubMembership" cm
					WHERE cm."userId" = ${userId}
				)`,
				reviewsWrittenCount: sql<number>`(
					SELECT COUNT(*)
					FROM "Review" r
					WHERE r."authorId" = ${userId}
				)`,
				reviewsReceivedCount: sql<number>`(
					SELECT COUNT(*)
					FROM "Review" r
					WHERE r."userId" = ${userId}
				)`,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		const stats = userStats[0];
		if (!stats) {
			throw apiError.notFound("User not found");
		}

		// Single optimized query for club memberships with all club data and aggregates
		const membershipsWithClubs = await db
			.select({
				// Membership fields
				id: clubMembership.id,
				userId: clubMembership.userId,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
				startDate: clubMembership.startDate,
				endDate: clubMembership.endDate,
				createdAt: clubMembership.createdAt,
				updatedAt: clubMembership.updatedAt,
				// Club fields
				clubName: club.name,
				clubSlug: club.slug,
				clubDescription: club.description,
				clubLogo: club.logo,
				clubLocation: club.location,
				clubWebsite: club.website,
				clubIsPrivate: club.isPrivate,
				clubVerified: club.verified,
				clubCreatedAt: club.createdAt,
				// Aggregated counts using subqueries
				memberCount: sql<number>`(
					SELECT COUNT(*)
					FROM "ClubMembership" cm
					WHERE cm."clubId" = "ClubMembership"."clubId"
				)`,
				eventCount: sql<number>`(
					SELECT COUNT(*)
					FROM "Event" e
					WHERE e."clubId" = "ClubMembership"."clubId"
				)`,
				reviewCount: sql<number>`(
					SELECT COUNT(*)
					FROM "Review" r
					WHERE r."clubId" = "ClubMembership"."clubId" AND r."type" = 'CLUB'
				)`,
				// Upcoming event data
				upcomingEventId: sql<string | null>`(
					SELECT e."id"
					FROM "Event" e
					WHERE e."clubId" = "ClubMembership"."clubId" AND e."dateStart" >= NOW()
					ORDER BY e."dateStart" ASC
					LIMIT 1
				)`,
				upcomingEventName: sql<string | null>`(
					SELECT e."name"
					FROM "Event" e
					WHERE e."clubId" = "ClubMembership"."clubId" AND e."dateStart" >= NOW()
					ORDER BY e."dateStart" ASC
					LIMIT 1
				)`,
				upcomingEventDateStart: sql<string | null>`(
					SELECT e."dateStart"
					FROM "Event" e
					WHERE e."clubId" = "ClubMembership"."clubId" AND e."dateStart" >= NOW()
					ORDER BY e."dateStart" ASC
					LIMIT 1
				)`,
				// Latest review content
				latestReviewContent: sql<string | null>`(
					SELECT r."content"
					FROM "Review" r
					WHERE r."clubId" = "ClubMembership"."clubId" AND r."type" = 'CLUB'
					ORDER BY r."createdAt" DESC
					LIMIT 1
				)`,
			})
			.from(clubMembership)
			.innerJoin(club, eq(clubMembership.clubId, club.id))
			.where(eq(clubMembership.userId, userId));

		// Transform flat results into nested structure
		const formattedMemberships = membershipsWithClubs.map((m) => ({
			id: m.id,
			userId: m.userId,
			clubId: m.clubId,
			role: m.role,
			startDate: m.startDate,
			endDate: m.endDate,
			createdAt: m.createdAt,
			updatedAt: m.updatedAt,
			club: {
				id: m.clubId,
				name: m.clubName,
				slug: m.clubSlug,
				description: m.clubDescription,
				logo: m.clubLogo,
				location: m.clubLocation,
				website: m.clubWebsite,
				isPrivate: m.clubIsPrivate,
				verified: m.clubVerified,
				createdAt: m.clubCreatedAt,
				_count: {
					members: Number(m.memberCount),
					events: Number(m.eventCount),
					reviews: Number(m.reviewCount),
				},
				events:
					m.upcomingEventId && m.upcomingEventName && m.upcomingEventDateStart
						? [
								{
									id: m.upcomingEventId,
									name: m.upcomingEventName,
									dateStart: m.upcomingEventDateStart,
								},
							]
						: [],
				reviews: m.latestReviewContent ? [{ content: m.latestReviewContent }] : [],
			},
		}));

		// Single optimized query for event registrations with event data
		const registrationsWithEvents = await db
			.select({
				// Registration fields
				id: eventRegistration.id,
				eventId: eventRegistration.eventId,
				createdById: eventRegistration.createdById,
				type: eventRegistration.type,
				paymentMethod: eventRegistration.paymentMethod,
				attended: eventRegistration.attended,
				createdAt: eventRegistration.createdAt,
				updatedAt: eventRegistration.updatedAt,
				// Event fields
				eventName: event.name,
				eventSlug: event.slug,
				eventDateStart: event.dateStart,
			})
			.from(eventRegistration)
			.leftJoin(event, eq(eventRegistration.eventId, event.id))
			.where(eq(eventRegistration.createdById, userId))
			.orderBy(eventRegistration.createdAt)
			.limit(5);

		// Transform flat results into nested structure
		const formattedRegistrations = registrationsWithEvents.map((r) => ({
			id: r.id,
			eventId: r.eventId,
			createdById: r.createdById,
			type: r.type,
			paymentMethod: r.paymentMethod,
			attended: r.attended,
			createdAt: r.createdAt,
			updatedAt: r.updatedAt,
			event: r.eventName
				? {
						id: r.eventId,
						name: r.eventName,
						slug: r.eventSlug,
						dateStart: r.eventDateStart,
					}
				: null,
		}));

		return response.json({
			eventRegistration: Number(stats.eventRegCount),
			clubMembership: Number(stats.membershipCount),
			reviewsWritten: Number(stats.reviewsWrittenCount),
			reviewsReceived: Number(stats.reviewsReceivedCount),
			clubMembershipDetails: formattedMemberships,
			eventRegistrationDetails: formattedRegistrations,
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
	"/users/:id/account",
	async ({ params, response, context }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || (context.user.id !== userId && !context.isAdmin)) {
			throw apiError.unauthorized("Unauthorized");
		}

		const userAccounts = await db.select().from(account).where(eq(account.userId, userId));

		return response.json({
			hasPassword: userAccounts.some((account) => account.password !== null),
		});
	},
	{
		auth: true,
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
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.put(
	"/users/:id/theme",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

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
	"/users/:id/font",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

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
	"/users/:id/style",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

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

usersRouter.put(
	"/users/:id/language",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

		await db
			.update(user)
			.set({
				language: body.language,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(user.id, userId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Update user language",
			description: "Update the user's language preference",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				language: z.enum(["bs", "en", "sr"]),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.get(
	"/users/invites",
	async ({ context, response }) => {
		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}
		const invitesData = await db
			.select()
			.from(clubInvite)
			.where(and(eq(clubInvite.email, context.user.email), eq(clubInvite.status, "PENDING")));

		const invitesWithClubs = await Promise.all(
			invitesData.map(async (invite) => {
				const [clubData, memberCountData] = await Promise.all([
					db.select().from(club).where(eq(club.id, invite.clubId)).limit(1),
					db.select({ count: count() }).from(clubMembership).where(eq(clubMembership.clubId, invite.clubId)),
				]);
				if (!clubData[0]) {
					return null;
				}
				return {
					...invite,
					club: {
						...clubData[0],
						_count: {
							members: memberCountData[0]?.count || 0,
						},
					},
				} as typeof invite & { club: (typeof clubData)[0] & { _count: { members: number } } };
			}),
		);

		const invites = invitesWithClubs.filter((invite): invite is NonNullable<typeof invite> => invite !== null);

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
							club: publicClubSchema.extend({
								_count: z.object({
									members: z.number(),
								}),
							}),
						}),
					),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.get(
	"/users/invites/count",
	async ({ context, response }) => {
		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
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
	"/users/:id/image/upload-url",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

		try {
			const result = await getS3UploadUrl(`user/${userId}/image`, body.type, body.size, userId);
			return response.json(result);
		} catch (error) {
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
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
	"/users/:id/header-image/upload-url",
	async ({ params, response, context, body }) => {
		const userId = params.id;
		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

		try {
			const result = await getS3UploadUrl(`user/${userId}/header`, body.type, body.size, userId);
			return response.json(result);
		} catch (error) {
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
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
	"/users/:id/daily-quota",
	async ({ params, response, context }) => {
		const userId = params.id;

		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
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

usersRouter.get(
	"/users/me/clubs",
	async ({ context, response }) => {
		if (!context.user) {
			throw apiError.unauthorized("Authentication required");
		}

		const memberships = await db.select().from(clubMembership).where(eq(clubMembership.userId, context.user.id));

		const userClubs = await Promise.all(
			memberships.map(async (membership) => {
				const clubData = await db.select().from(club).where(eq(club.id, membership.clubId)).limit(1);
				return clubData[0];
			}),
		);

		return response.json({
			clubs: userClubs.filter((club): club is NonNullable<typeof club> => club !== undefined),
		});
	},
	{
		schema: {
			tags: ["Users"],
			summary: "Get current user's clubs",
			description: "Get all clubs the authenticated user is a member of",
			response: {
				200: z.object({
					clubs: z.array(baseClubSchema),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

usersRouter.post(
	"/users/:id/delete",
	async ({ params, response, context, body }) => {
		const userId = params.id;

		if (!userId) {
			throw apiError.validation("User ID is required");
		}

		if (!context.user || context.user.id !== userId) {
			throw apiError.unauthorized("Unauthorized");
		}

		const userData = await db
			.select({
				id: user.id,
				email: user.email,
				twoFactorEnabled: user.twoFactorEnabled,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!userData[0]) {
			throw apiError.notFound("User not found");
		}

		const accountData = await db
			.select({
				password: account.password,
			})
			.from(account)
			.where(eq(account.userId, userId))
			.limit(1);

		const hasPassword = accountData[0]?.password !== null && accountData[0]?.password !== undefined;

		if (hasPassword) {
			if (!body.password) {
				throw apiError.validation("Password is required");
			}

			if (!accountData[0]?.password) {
				throw apiError.internal("Password data not found");
			}

			const isPasswordValid = await bcrypt.compare(body.password, accountData[0].password);
			if (!isPasswordValid) {
				throw apiError.unauthorized("Invalid password");
			}
		}

		const ownedClubs = await db
			.select({
				clubId: clubMembership.clubId,
			})
			.from(clubMembership)
			.where(and(eq(clubMembership.userId, userId), eq(clubMembership.role, "CLUB_OWNER")));

		for (const ownedClub of ownedClubs) {
			const managers = await db
				.select({
					id: clubMembership.id,
					userId: clubMembership.userId,
				})
				.from(clubMembership)
				.where(
					and(
						eq(clubMembership.clubId, ownedClub.clubId),
						eq(clubMembership.role, "MANAGER"),
						ne(clubMembership.userId, userId),
					),
				);

			if (managers.length > 0) {
				const randomManager = managers[Math.floor(Math.random() * managers.length)];
				if (randomManager) {
					await db
						.update(clubMembership)
						.set({
							role: "CLUB_OWNER",
							updatedAt: new Date().toISOString(),
						})
						.where(eq(clubMembership.id, randomManager.id));

					await logClubAudit({
						clubId: ownedClub.clubId,
						actionType: "CLUB_OWNER_TRANSFERRED",
						actionData: {
							fromUserId: userId,
							toUserId: randomManager.userId,
							reason: "User account deletion",
						},
						userId: userId,
					});
				}
			} else {
				await db
					.delete(clubMembership)
					.where(and(eq(clubMembership.clubId, ownedClub.clubId), eq(clubMembership.userId, userId)));

				await logClubAudit({
					clubId: ownedClub.clubId,
					actionType: "CLUB_OWNER_REMOVED",
					actionData: {
						userId: userId,
						reason: "User account deletion - no managers available",
					},
					userId: userId,
				});
			}
		}

		await db.delete(user).where(eq(user.id, userId));

		posthog.capture({
			distinctId: userId,
			event: "user_account_deleted",
			properties: {
				email: userData[0].email,
			},
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Users"],
			summary: "Delete user account",
			description:
				"Delete the current user's account. Requires password confirmation and 2FA if enabled. Transfers club ownership to random manager if available.",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				password: z.string().optional(),
				twoFactorCode: z.string().optional(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);
