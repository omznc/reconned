import { render } from "@react-email/components";
import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, ilike, inArray, not, or } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { club, clubMembership, user } from "../drizzle/schema";
import ClubClaimRequestEmail from "../emails/club-claim-request";
import { logClubAudit } from "../lib/audit-logger";
import { db } from "../lib/db";
import { sendEmail } from "../lib/mail";
import { Router, responseSchema } from "../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../lib/schemas";

const adminRouter = new Router();

const baseUserSchema = createSelectSchema(user);
const baseClubSchema = createSelectSchema(club);
const baseClubMembershipSchema = createSelectSchema(clubMembership);

function requireAdmin(context: { isAdmin: boolean }) {
	if (!context.isAdmin) {
		throw new Error("Unauthorized - admin access required");
	}
}

adminRouter.get(
	"/api/admin/users",
	async ({ query, response, context }) => {
		requireAdmin(context);

		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

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

		let orderBy:
			| typeof user.name
			| typeof user.email
			| typeof user.callsign
			| typeof user.createdAt
			| ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(user.name) : user.name;
		} else if (sortBy === "email") {
			orderBy = sortOrder === "desc" ? desc(user.email) : user.email;
		} else if (sortBy === "callsign") {
			orderBy = sortOrder === "desc" ? desc(user.callsign) : user.callsign;
		} else {
			orderBy = sortOrder === "desc" ? desc(user.createdAt) : user.createdAt;
		}

		const users = await db.select().from(user).where(where).orderBy(orderBy).limit(perPage).offset(offset);

		const memberships = await Promise.all(
			users.map(async (u) => {
				const userMemberships = await db
					.select({
						id: clubMembership.id,
						clubId: clubMembership.clubId,
						role: clubMembership.role,
					})
					.from(clubMembership)
					.where(eq(clubMembership.userId, u.id));

				const clubs = await Promise.all(
					userMemberships.map(async (m) => {
						const clubData = await db
							.select({ name: club.name })
							.from(club)
							.where(eq(club.id, m.clubId))
							.limit(1);
						return {
							...m,
							club: clubData[0] || null,
						};
					}),
				);

				return {
					...u,
					gear: u.gear as z.infer<typeof baseUserSchema>["gear"],
					clubMembership: clubs,
				};
			}),
		);

		const total = await db.select({ count: count() }).from(user).where(where);

		return response.json({
			users: memberships,
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List all users",
			description: "Admin endpoint to list all users with pagination, search, and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "email", "callsign", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					users: z.array(
						baseUserSchema.extend({
							clubMembership: z.array(
								baseClubMembershipSchema.pick({ id: true, clubId: true, role: true }).extend({
									club: z.object({ name: z.string() }).nullable(),
								}),
							),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/users/:id",
	async ({ params, response, context }) => {
		requireAdmin(context);

		const userId = params.id;
		if (!userId) {
			return response.error({ error: "User ID is required" }, 400);
		}

		const userData = await db.select().from(user).where(eq(user.id, userId)).limit(1);

		if (!userData[0]) {
			return response.error({ error: "User not found" }, 404);
		}

		const memberships = await db
			.select({
				id: clubMembership.id,
				clubId: clubMembership.clubId,
				role: clubMembership.role,
			})
			.from(clubMembership)
			.where(eq(clubMembership.userId, userId));

		const clubs = await Promise.all(
			memberships.map(async (m) => {
				const clubData = await db.select({ name: club.name }).from(club).where(eq(club.id, m.clubId)).limit(1);
				return {
					...m,
					club: clubData[0] || null,
				};
			}),
		);

		return response.json({
			...userData[0],
			gear: userData[0].gear as z.infer<typeof baseUserSchema>["gear"],
			clubMembership: clubs,
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get user details",
			description: "Admin endpoint to get user details with club memberships",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseUserSchema.extend({
					clubMembership: z.array(
						baseClubMembershipSchema.pick({ id: true, clubId: true, role: true }).extend({
							club: z.object({ name: z.string() }).nullable(),
						}),
					),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/users/count",
	async ({ query, response, context }) => {
		requireAdmin(context);

		const { search = "" } = query || {};

		const whereConditions = [];

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

		const total = await db.select({ count: count() }).from(user).where(where);

		return response.json({ count: total[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Count users",
			description: "Admin endpoint to count users with optional search filter",
			query: z.object({
				search: z.string().optional(),
			}),
			response: {
				200: z.object({ count: z.number() }),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/clubs",
	async ({ query, response, context }) => {
		requireAdmin(context);

		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		const ownerMemberships = await db
			.select({ clubId: clubMembership.clubId })
			.from(clubMembership)
			.where(eq(clubMembership.role, "CLUB_OWNER"));

		const ownedClubIds = ownerMemberships.map((m) => m.clubId);

		if (ownedClubIds.length > 0) {
			whereConditions.push(inArray(club.id, ownedClubIds));
		} else {
			return response.json({
				clubs: [],
				pagination: {
					page,
					perPage,
					total: 0,
					totalPages: 0,
				},
			});
		}

		const where = and(...whereConditions);

		let orderBy: typeof club.name | typeof club.location | typeof club.createdAt | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(club.name) : club.name;
		} else if (sortBy === "location") {
			orderBy = sortOrder === "desc" ? desc(club.location) : club.location;
		} else {
			orderBy = sortOrder === "desc" ? desc(club.createdAt) : club.createdAt;
		}

		const clubs = await db.select().from(club).where(where).orderBy(orderBy).limit(perPage).offset(offset);

		const total = await db.select({ count: count() }).from(club).where(where);

		return response.json({
			clubs,
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List all clubs",
			description: "Admin endpoint to list all clubs with pagination, search, and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "location", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					clubs: z.array(baseClubSchema),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/clubs/:id",
	async ({ params, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const ownerMembership = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		if (!ownerMembership[0]) {
			return response.error({ error: "Club not found or has no owner" }, 404);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		return response.json(clubData[0]);
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get club details",
			description: "Admin endpoint to get club details",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseClubSchema,
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/clubs/count",
	async ({ query, response, context }) => {
		requireAdmin(context);

		const { search = "" } = query || {};

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		const ownerMemberships = await db
			.select({ clubId: clubMembership.clubId })
			.from(clubMembership)
			.where(eq(clubMembership.role, "CLUB_OWNER"));

		const ownedClubIds = ownerMemberships.map((m) => m.clubId);

		if (ownedClubIds.length > 0) {
			whereConditions.push(inArray(club.id, ownedClubIds));
		} else {
			return response.json({ count: 0 });
		}

		const where = and(...whereConditions);

		const total = await db.select({ count: count() }).from(club).where(where);

		return response.json({ count: total[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Count clubs",
			description: "Admin endpoint to count clubs with optional search filter",
			query: z.object({
				search: z.string().optional(),
			}),
			response: {
				200: z.object({ count: z.number() }),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.put(
	"/api/admin/clubs/:id/ban",
	async ({ params, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		await db
			.update(club)
			.set({
				banned: true,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Ban club",
			description: "Admin endpoint to ban a club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.put(
	"/api/admin/clubs/:id/unban",
	async ({ params, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		await db
			.update(club)
			.set({
				banned: false,
				banReason: null,
				banExpires: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Unban club",
			description: "Admin endpoint to unban a club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.delete(
	"/api/admin/clubs/:id",
	async ({ params, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		await db.delete(club).where(eq(club.id, clubId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Delete club",
			description: "Admin endpoint to delete a club",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/unclaimed-clubs",
	async ({ query, response, context }) => {
		requireAdmin(context);

		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		const ownerMemberships = await db
			.select({ clubId: clubMembership.clubId })
			.from(clubMembership)
			.where(eq(clubMembership.role, "CLUB_OWNER"));

		const ownedClubIds = ownerMemberships.map((m) => m.clubId);

		if (ownedClubIds.length > 0) {
			whereConditions.push(not(inArray(club.id, ownedClubIds)));
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderBy: typeof club.name | typeof club.location | typeof club.createdAt | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(club.name) : club.name;
		} else if (sortBy === "location") {
			orderBy = sortOrder === "desc" ? desc(club.location) : club.location;
		} else {
			orderBy = sortOrder === "desc" ? desc(club.createdAt) : club.createdAt;
		}

		const clubs = await db.select().from(club).where(where).orderBy(orderBy).limit(perPage).offset(offset);

		const clubsWithCounts = await Promise.all(
			clubs.map(async (c) => {
				const memberCount = await db
					.select({ count: count() })
					.from(clubMembership)
					.where(eq(clubMembership.clubId, c.id));

				return {
					...c,
					_count: {
						members: memberCount[0]?.count || 0,
					},
				};
			}),
		);

		const total = await db.select({ count: count() }).from(club).where(where);

		return response.json({
			clubs: clubsWithCounts,
			pagination: {
				page,
				perPage,
				total: total[0]?.count || 0,
				totalPages: Math.ceil((total[0]?.count || 0) / perPage),
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "List unclaimed clubs",
			description: "Admin endpoint to list unclaimed clubs (clubs without CLUB_OWNER)",
			query: paginationQuerySchema.extend({
				search: z.string().optional(),
				sortBy: z.enum(["name", "location", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					clubs: z.array(
						baseClubSchema.extend({
							_count: z.object({
								members: z.number(),
							}),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/unclaimed-clubs/:id",
	async ({ params, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		const memberCount = await db
			.select({ count: count() })
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubId));

		return response.json({
			...clubData[0],
			_count: {
				members: memberCount[0]?.count || 0,
			},
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get unclaimed club details",
			description: "Admin endpoint to get unclaimed club details",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: baseClubSchema.extend({
					_count: z.object({
						members: z.number(),
					}),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.get(
	"/api/admin/unclaimed-clubs/count",
	async ({ query, response, context }) => {
		requireAdmin(context);

		const { search = "" } = query || {};

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		const ownerMemberships = await db
			.select({ clubId: clubMembership.clubId })
			.from(clubMembership)
			.where(eq(clubMembership.role, "CLUB_OWNER"));

		const ownedClubIds = ownerMemberships.map((m) => m.clubId);

		if (ownedClubIds.length > 0) {
			whereConditions.push(not(inArray(club.id, ownedClubIds)));
		}

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const total = await db.select({ count: count() }).from(club).where(where);

		return response.json({ count: total[0]?.count || 0 });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Count unclaimed clubs",
			description: "Admin endpoint to count unclaimed clubs with optional search filter",
			query: z.object({
				search: z.string().optional(),
			}),
			response: {
				200: z.object({ count: z.number() }),
				...responseSchema([401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.post(
	"/api/admin/unclaimed-clubs",
	async ({ body, response, context }) => {
		requireAdmin(context);

		const clubId = randomUUIDv7();
		const now = new Date().toISOString();

		const newClub = await db
			.insert(club)
			.values({
				id: clubId,
				name: body.name,
				countryId: body.countryId || null,
				location: body.location || null,
				latitude: body.latitude || null,
				longitude: body.longitude || null,
				description: body.description || null,
				slug: body.slug || null,
				dateFounded: body.dateFounded || null,
				isAllied: body.isAllied || false,
				isPrivate: body.isPrivate || false,
				isPrivateStats: body.isPrivateStats || false,
				logo: null,
				headerImage: null,
				contactPhone: body.contactPhone || null,
				contactEmail: body.contactEmail || null,
				website: body.website || null,
				instagramUsername: body.instagramUsername || null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		if (!newClub[0]) {
			return response.error({ error: "Failed to create club" }, 500);
		}

		await logClubAudit({
			clubId: newClub[0].id,
			actionType: "CLUB_CREATE",
			actionData: {
				name: body.name,
				location: body.location,
				slug: body.slug,
				createdByAdmin: true,
				unclaimed: true,
			},
			userId: context.user.id,
		});

		return response.json({ id: newClub[0].id, club: newClub[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Create unclaimed club",
			description: "Admin endpoint to create an unclaimed club",
			body: z.object({
				name: z.string().min(1),
				countryId: z.number().optional(),
				location: z.string().optional(),
				latitude: z.number().optional(),
				longitude: z.number().optional(),
				description: z.string().optional(),
				slug: z.string().optional(),
				dateFounded: z.string().optional(),
				isAllied: z.boolean().optional(),
				isPrivate: z.boolean().optional(),
				isPrivateStats: z.boolean().optional(),
				contactPhone: z.string().optional(),
				contactEmail: z.string().email().optional(),
				website: z.string().url().optional(),
				instagramUsername: z.string().optional(),
			}),
			response: {
				200: z.object({
					id: z.string(),
					club: baseClubSchema,
				}),
				...responseSchema([400, 401, 403, 500], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.put(
	"/api/admin/unclaimed-clubs/:id/logo",
	async ({ params, body, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		await db
			.update(club)
			.set({
				logo: body.logo,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Update unclaimed club logo",
			description: "Admin endpoint to update unclaimed club logo",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				logo: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.put(
	"/api/admin/unclaimed-clubs/:id/header-image",
	async ({ params, body, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		await db
			.update(club)
			.set({
				headerImage: body.headerImage,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Update unclaimed club header image",
			description: "Admin endpoint to update unclaimed club header image",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				headerImage: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.post(
	"/api/admin/unclaimed-clubs/:id/assign-owner",
	async ({ params, body, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		const existingOwner = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		if (existingOwner[0]) {
			return response.error({ error: "Club already has an owner" }, 400);
		}

		const now = new Date().toISOString();

		await db.insert(clubMembership).values({
			id: randomUUIDv7(),
			clubId,
			userId: body.userId,
			role: "CLUB_OWNER",
			startDate: now,
			endDate: null,
			createdAt: now,
			updatedAt: now,
		});

		await logClubAudit({
			clubId,
			actionType: "CLUB_OWNER_ASSIGNED",
			actionData: {
				userId: body.userId,
				assignedBy: context.user.id,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Assign club owner",
			description: "Admin endpoint to assign owner to unclaimed club",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				userId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminRouter.post(
	"/api/admin/unclaimed-clubs/:id/claim-request",
	async ({ params, body, response, context }) => {
		requireAdmin(context);

		const clubId = params.id;
		if (!clubId) {
			return response.error({ error: "Club ID is required" }, 400);
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			return response.error({ error: "Club not found" }, 404);
		}

		const existingOwner = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		if (existingOwner[0]) {
			return response.error({ error: "Club already has an owner" }, 400);
		}

		const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, "admin"));

		if (admins.length === 0) {
			return response.error({ error: "No admins found" }, 500);
		}

		const requesterData = await db.select().from(user).where(eq(user.id, context.user.id)).limit(1);

		if (!requesterData[0]) {
			return response.error({ error: "Requester not found" }, 404);
		}

		const adminEmails = admins.map((a) => a.email);

		try {
			await sendEmail({
				to: adminEmails,
				subject: `Club Claim Request: ${clubData[0].name}`,
				html: await render(
					ClubClaimRequestEmail({
						clubName: clubData[0].name,
						clubLogo: clubData[0].logo,
						clubLocation: clubData[0].location,
						requesterName: requesterData[0].name,
						requesterEmail: requesterData[0].email,
						requesterCallsign: requesterData[0].callsign,
						message: body?.message || null,
						clubId,
					}),
					{
						pretty: true,
					},
				),
			});
		} catch (error) {
			console.error("Failed to send claim request email:", error);
			return response.error({ error: "Failed to send email" }, 500);
		}

		return response.json({
			success: true,
			message: "Claim request email sent to admins",
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Send claim request email",
			description: "Admin endpoint to send claim request email to admins",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				message: z.string().optional(),
			}),
			response: {
				200: z.object({
					success: z.boolean(),
					message: z.string(),
				}),
				...responseSchema([400, 401, 403, 404, 500], z.object({ error: z.string() })),
			},
		},
	},
);

export { adminRouter };
