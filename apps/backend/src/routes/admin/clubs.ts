import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership } from "../../drizzle/schema";
import { db } from "../../lib/db";
import { apiError } from "../../lib/errors";
import { posthog } from "../../lib/posthog";
import { Router, responseSchema } from "../../lib/router";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const adminClubsRouter = new Router();

const baseClubSchema = z.object({
	id: z.string(),
	name: z.string(),
	location: z.string().nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	description: z.string().nullable(),
	dateFounded: z.string().nullable(),
	slug: z.string().nullable(),
	isAllied: z.boolean(),
	isPrivate: z.boolean(),
	isPrivateStats: z.boolean(),
	logo: z.string().nullable(),
	contactPhone: z.string().nullable(),
	contactEmail: z.string().nullable(),
	verified: z.boolean(),
	website: z.url().nullable(),
	instagramUsername: z.string().nullable(),
	instagramProfilePictureUrl: z.string().nullable(),
	instagramAccessToken: z.string().nullable(),
	instagramTokenExpiry: z.string().nullable(),
	instagramRefreshToken: z.string().nullable(),
	instagramConnected: z.boolean(),
	instagramBusinessId: z.string().nullable(),
	facebookPageId: z.string().nullable(),
	instagramTokenType: z.string().nullable(),
	countryId: z.number().nullable(),
	banned: z.boolean().nullable(),
	banReason: z.string().nullable(),
	banExpires: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	headerImage: z.string().nullable(),
});

adminClubsRouter.get(
	"/admin/clubs",
	async ({ query, response, context: _context }) => {
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

adminClubsRouter.get(
	"/admin/clubs/:id",
	async ({ params, response, context: _context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const ownerMembership = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		if (!ownerMembership[0]) {
			throw apiError.notFound("Club not found or has no owner");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
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

adminClubsRouter.put(
	"/admin/clubs/:id/ban",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		await db
			.update(club)
			.set({
				banned: true,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		// Track club ban by admin
		posthog.capture({
			distinctId: context.user.id,
			event: "club_banned_by_admin",
			properties: {
				club_id: clubId,
				club_name: clubData[0].name,
				admin_action: true,
			},
		});

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

adminClubsRouter.put(
	"/admin/clubs/:id/unban",
	async ({ params, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
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

		// Track club unban by admin
		posthog.capture({
			distinctId: context.user.id,
			event: "club_unbanned_by_admin",
			properties: {
				club_id: clubId,
				club_name: clubData[0].name,
				admin_action: true,
			},
		});

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
				...responseSchema([401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminClubsRouter.delete(
	"/admin/clubs/:id",
	async ({ params, response, context: _context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
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

export { adminClubsRouter };
