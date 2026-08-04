import { apiError, Router } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, post } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { NO_CITY, resolveClubCity } from "../../lib/city";
import { db } from "../../lib/db";
import { isFeatureEnabled } from "../../lib/feature-flags";
import { logger } from "../../lib/posthog";
import {
	httpsUrl,
	logoTileOf,
	logoTileResponseSchema,
	logoTileSchema,
	paginationQuerySchema,
	paginationResponseSchema,
} from "../../lib/schemas";
import { deleteS3Files, getS3UploadUrl, keyFromCdnUrl, MAX_UPLOAD_FILE_SIZE } from "../../lib/storage";

const clubsCoreRouter = new Router();

/** A club someone actually runs: it has an owner. Directory entries do not. */
const CLAIMED = sql`EXISTS (
	SELECT 1 FROM "ClubMembership" cm
	WHERE cm."clubId" = ${club.id} AND cm."role" = 'CLUB_OWNER'
)`;

/** In at least one alliance, by the join table or the legacy flag. */
const ALLIED = sql`(${club.isAllied} OR EXISTS (
	SELECT 1 FROM "ClubAlliance" ca WHERE ca."clubId" = ${club.id}
))`;

const baseClubSchema = createSelectSchema(club);

const publicClubSchema = baseClubSchema
	.omit({
		instagramAccessToken: true,
		instagramRefreshToken: true,
		instagramTokenExpiry: true,
		facebookPageId: true,
		instagramTokenType: true,
	})
	// The column is plain text, but only ever holds the two tile names, and
	// clients switch on it — so it goes out as the union rather than as `string`.
	.extend({ logoTile: logoTileResponseSchema });

const createClubBodySchema = z.object({
	name: z.string().min(1).max(50),
	countryId: z.number().describe("Country ID. Use the list_countries tool to find the correct ID."),
	location: z.string().min(1).max(50),
	cityId: z
		.number()
		.nullable()
		.optional()
		.describe(
			"City ID from the seeded city reference table. Groups the club onto that city's landing page; the display name and URL slug are copied server-side.",
		),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	description: z.string().max(5000).optional(),
	slug: z.string().max(50).optional(),
	dateFounded: z.string().datetime().optional(),
	isAllied: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isPrivateStats: z.boolean().optional(),
	logo: z.string().optional(),
	logoTile: logoTileSchema,
	headerImage: z.string().optional(),
	contactPhone: z.string().max(20).optional(),
	contactEmail: z.string().max(255).optional(),
	website: httpsUrl.optional(),
	instagramUsername: z.string().max(30).optional(),
});

const updateClubBodySchema = z.object({
	name: z.string().min(1).max(50).optional(),
	countryId: z.number().optional().describe("Country ID. Use the list_countries tool to find the correct ID."),
	location: z.string().min(1).max(50).optional(),
	cityId: z
		.number()
		.nullable()
		.optional()
		.describe(
			"City ID from the seeded city reference table, or null to clear it. Groups the club onto that city's landing page; the display name and URL slug are copied server-side.",
		),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	description: z.string().max(5000).optional(),
	slug: z.string().max(50).optional(),
	dateFounded: z.string().datetime().optional(),
	isAllied: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isPrivateStats: z.boolean().optional(),
	logo: z.string().nullable().optional(),
	logoTile: logoTileSchema,
	headerImage: z.string().nullable().optional(),
	contactPhone: z.string().max(20).optional(),
	contactEmail: z.string().max(255).optional(),
	website: httpsUrl.optional(),
	instagramUsername: z.string().max(30).optional(),
});

const clubLogoUploadBodySchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(MAX_UPLOAD_FILE_SIZE),
	}),
});

async function validateSlug(slug: string, excludeClubId?: string): Promise<boolean> {
	const [clubBySlug, clubById] = await Promise.all([
		db.select().from(club).where(eq(club.slug, slug)).limit(1),
		db.select().from(club).where(eq(club.id, slug)).limit(1),
	]);

	if (excludeClubId) {
		return !(clubBySlug[0] && clubBySlug[0].id !== excludeClubId) && !clubById[0];
	}

	return !clubBySlug[0] && !clubById[0];
}

clubsCoreRouter.get(
	"/clubs",
	async ({ response, query, context }) => {
		const { page = 1, perPage = 25, search = "" } = query;
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		const isAdmin = context.isAdmin;
		const requestingUserId = context.user?.id;

		// Check ONLY_VERIFIED_CLUBS_VISIBLE feature flag
		const onlyVerifiedClubs = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");
		if (onlyVerifiedClubs && !isAdmin) {
			whereConditions.push(eq(club.verified, true));
		}

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		if (!isAdmin) {
			if (requestingUserId) {
				const userMemberships = await db
					.select({ clubId: clubMembership.clubId })
					.from(clubMembership)
					.where(eq(clubMembership.userId, requestingUserId));

				const memberClubIds = userMemberships.map((m) => m.clubId);

				if (memberClubIds.length > 0) {
					whereConditions.push(or(eq(club.isPrivate, false), inArray(club.id, memberClubIds)));
				} else {
					whereConditions.push(eq(club.isPrivate, false));
				}
			} else {
				whereConditions.push(eq(club.isPrivate, false));
			}
		}

		const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		const { sortBy, sortOrder } = query;

		const orderBy: Array<ReturnType<typeof asc | typeof desc> | SQL> = [];

		if (sortBy && sortOrder) {
			const orderFn = sortOrder === "desc" ? desc : asc;
			if (sortBy === "name") orderBy.push(orderFn(club.name));
			if (sortBy === "location") orderBy.push(orderFn(club.location));
			if (sortBy === "createdAt") orderBy.push(orderFn(club.createdAt));
		}

		// Build member count subquery once, reuse in SELECT and ORDER BY
		const memberCountSubquery = db
			.select({
				clubId: clubMembership.clubId,
				count: count().as("member_count"),
			})
			.from(clubMembership)
			.groupBy(clubMembership.clubId)
			.as("member_counts");

		// Standing: the browse page leads with the clubs a visitor is most likely
		// looking for. Verified first, then clubs someone actually runs — an
		// alliance ahead of none at each level — and the unclaimed directory
		// entries last, since nobody is behind them yet.
		if (!sortBy) {
			orderBy.push(sql`
				CASE
					WHEN ${club.verified} THEN 0
					WHEN ${CLAIMED} AND ${ALLIED} THEN 1
					WHEN ${CLAIMED} THEN 2
					WHEN ${ALLIED} THEN 3
					ELSE 4
				END
			`);
		}

		if (sortBy !== "name") orderBy.push(asc(club.name));
		orderBy.push(desc(club.verified));
		orderBy.push(desc(memberCountSubquery.count));

		const clubsWithMemberCounts = await db
			.select({
				id: club.id,
				name: club.name,
				location: club.location,
				cityId: club.cityId,
				city: club.city,
				citySlug: club.citySlug,
				latitude: club.latitude,
				longitude: club.longitude,
				description: club.description,
				dateFounded: club.dateFounded,
				logo: club.logo,
				logoTile: club.logoTile,
				headerImage: club.headerImage,
				isPrivate: club.isPrivate,
				isPrivateStats: club.isPrivateStats,
				verified: club.verified,
				isAllied: club.isAllied,
				slug: club.slug,
				createdAt: club.createdAt,
				updatedAt: club.updatedAt,
				countryId: club.countryId,
				website: club.website,
				banned: club.banned,
				banReason: club.banReason,
				banExpires: club.banExpires,
				contactPhone: club.contactPhone,
				contactEmail: club.contactEmail,
				instagramConnected: club.instagramConnected,
				instagramUsername: club.instagramUsername,
				instagramProfilePictureUrl: club.instagramProfilePictureUrl,
				instagramBusinessId: club.instagramBusinessId,
				memberCount: sql<number>`COALESCE(${memberCountSubquery.count}, 0)`,
			})
			.from(club)
			.leftJoin(memberCountSubquery, eq(club.id, memberCountSubquery.clubId))
			.where(whereClause)
			.orderBy(...orderBy)
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(club).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({
			clubs: clubsWithMemberCounts.map((c) => ({
				id: c.id,
				name: c.name,
				location: c.location,
				cityId: c.cityId,
				city: c.city,
				citySlug: c.citySlug,
				latitude: c.latitude,
				longitude: c.longitude,
				description: c.description,
				dateFounded: c.dateFounded,
				logo: c.logo,
				logoTile: logoTileOf(c.logoTile),
				headerImage: c.headerImage,
				isPrivate: c.isPrivate,
				isPrivateStats: c.isPrivateStats,
				verified: c.verified,
				isAllied: c.isAllied,
				slug: c.slug,
				createdAt: c.createdAt,
				updatedAt: c.updatedAt,
				countryId: c.countryId,
				website: c.website,
				banned: c.banned,
				banReason: c.banReason,
				banExpires: c.banExpires,
				contactPhone: c.contactPhone,
				contactEmail: c.contactEmail,
				instagramConnected: c.instagramConnected,
				instagramUsername: c.instagramUsername,
				instagramProfilePictureUrl: c.instagramProfilePictureUrl,
				instagramBusinessId: c.instagramBusinessId,
				_count: {
					members: Number(c.memberCount),
				},
			})),
			pagination: {
				page,
				perPage,
				total,
				totalPages: Math.ceil(total / perPage),
			},
		});
	},
	{
		cache: {
			key: "clubs",
			ttl: 300,
			swr: 1800,
			varyByQuery: ["page", "perPage", "search", "sortBy", "sortOrder"],
			// NOT public-safe: private clubs the caller is a member of, and admin visibility.
			varyByUser: true,
		},
		schema: {
			tags: ["Clubs"],
			summary: "List clubs",
			description: "List clubs with pagination, search, and sorting",
			query: paginationQuerySchema.extend({
				search: z.string().max(100).optional(),
				sortBy: z.enum(["name", "location", "createdAt"]).optional(),
				sortOrder: z.enum(["asc", "desc"]).optional(),
			}),
			response: {
				200: z.object({
					clubs: z.array(
						publicClubSchema.extend({
							_count: z.object({
								members: z.number(),
							}),
						}),
					),
					pagination: paginationResponseSchema,
				}),
			},
			mcpTool: true,
		},
	},
);

clubsCoreRouter.get(
	"/clubs/:id",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db
			.select()
			.from(club)
			.where(or(eq(club.id, clubId), eq(club.slug, clubId)))
			.limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		// Check if user has access to this club (public or member)
		let hasAccess = !clubData[0].isPrivate;
		let isMember = false;
		if (clubData[0].isPrivate && context.user) {
			const membership = await db
				.select()
				.from(clubMembership)
				.where(and(eq(clubMembership.clubId, clubData[0].id), eq(clubMembership.userId, context.user.id)))
				.limit(1);
			hasAccess = !!membership[0];
			isMember = !!membership[0];
		}

		if (!hasAccess) {
			throw apiError.notFound("Club not found");
		}

		// Check ONLY_VERIFIED_CLUBS_VISIBLE feature flag
		// Members can still see their clubs even if unverified
		const onlyVerifiedClubs = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");
		if (onlyVerifiedClubs && !context.isAdmin && !clubData[0].verified && !isMember) {
			// For unverified clubs, only admins and members can see them when flag is enabled
			throw apiError.notFound("Club not found");
		}

		const membersCount = await db
			.select({ count: count() })
			.from(clubMembership)
			.where(eq(clubMembership.clubId, clubData[0].id));

		const postsCount = await db.select({ count: count() }).from(post).where(eq(post.clubId, clubData[0].id));

		return response.json({
			...clubData[0],
			logoTile: logoTileOf(clubData[0].logoTile),
			_count: {
				members: membersCount[0]?.count || 0,
				posts: postsCount[0]?.count || 0,
			},
		});
	},
	{
		auth: false,
		cache: {
			key: "club:{id}",
			ttl: 3600,
			swr: 86400,
			// Private/unverified clubs are visible only to members and admins.
			varyByUser: true,
		},
		schema: {
			tags: ["Clubs"],
			summary: "Get club by ID or slug",
			description: "Get club information by ID or slug (private clubs hidden from non-members)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: publicClubSchema.extend({
					_count: z.object({
						members: z.number(),
						posts: z.number(),
					}),
				}),
				400: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsCoreRouter.get(
	"/clubs/:id/information",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const membershipData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const membership = membershipData[0];

		if (!membership || (membership.role !== "MANAGER" && membership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		return response.json({
			...clubData[0],
			logoTile: logoTileOf(clubData[0].logoTile),
			isCurrentUserOwner: membership.role === "CLUB_OWNER",
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club information for editing",
			description: "Get club information for editing (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			mcpTool: true,
			response: {
				200: baseClubSchema.extend({
					logoTile: logoTileResponseSchema,
					isCurrentUserOwner: z.boolean(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsCoreRouter.post(
	"/clubs",
	async ({ context, response, body }) => {
		if (body.slug) {
			const valid = await validateSlug(body.slug);
			if (!valid) {
				throw apiError.validation("Slug is already taken");
			}
		}

		if (body.dateFounded) {
			const foundedDate = new Date(body.dateFounded);
			const today = new Date();
			today.setHours(23, 59, 59, 999); // End of today

			if (foundedDate > today) {
				throw apiError.validation("Date founded cannot be in the future");
			}
		}

		const clubId = randomUUIDv7();
		const now = new Date().toISOString();

		// The city is a reference-table row, not text: the client picks an id and the
		// display name and slug are copied from it. That is what stops two clubs in
		// the same city from spelling it differently and splitting the landing page.
		const cityColumns =
			body.cityId === undefined || body.cityId === null ? NO_CITY : await resolveClubCity(body.cityId);
		if (!cityColumns) {
			throw apiError.validation("Unknown city");
		}

		const newClub = await db
			.insert(club)
			.values({
				id: clubId,
				name: body.name,
				countryId: body.countryId,
				location: body.location,
				...cityColumns,
				latitude: body.latitude || null,
				longitude: body.longitude || null,
				description: body.description || null,
				slug: body.slug || null,
				dateFounded: body.dateFounded || null,
				isAllied: body.isAllied || false,
				isPrivate: body.isPrivate || false,
				isPrivateStats: body.isPrivateStats || false,
				logo: body.logo || null,
				logoTile: body.logoTile ?? null,
				headerImage: body.headerImage || null,
				contactPhone: body.contactPhone || null,
				contactEmail: body.contactEmail || null,
				website: body.website || null,
				instagramUsername: body.instagramUsername || null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		if (!newClub[0]) {
			throw apiError.internal("Failed to create club");
		}

		await db.insert(clubMembership).values({
			id: randomUUIDv7(),
			clubId: newClub[0].id,
			userId: context.user.id,
			role: "CLUB_OWNER",
			startDate: now,
			endDate: null,
			createdAt: now,
			updatedAt: now,
		});

		await logClubAudit({
			clubId: newClub[0].id,
			actionType: "CLUB_CREATE",
			actionData: {
				name: body.name,
				location: body.location,
				slug: body.slug,
			},
			userId: context.user.id,
		});

		return response.json({ id: newClub[0].id, club: { ...newClub[0], logoTile: logoTileOf(newClub[0].logoTile) } });
	},
	{
		auth: true,
		bustCache: ["clubs"],
		schema: {
			tags: ["Clubs"],
			summary: "Create club",
			description: "Create a new club and assign the creator as owner",
			body: createClubBodySchema,
			response: {
				200: z.object({
					id: z.string(),
					club: publicClubSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsCoreRouter.put(
	"/clubs/:id",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		// Fetch existing club data for validation checks
		const existingClubData = await db.select({ slug: club.slug }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!existingClubData[0]) {
			throw apiError.notFound("Club not found");
		}

		if (body.slug && body.slug !== existingClubData[0].slug) {
			const valid = await validateSlug(body.slug, clubId);
			if (!valid) {
				throw apiError.validation("Slug is already taken");
			}
		}

		if (body.dateFounded) {
			const foundedDate = new Date(body.dateFounded);
			const today = new Date();
			today.setHours(23, 59, 59, 999); // End of today

			if (foundedDate > today) {
				throw apiError.validation("Date founded cannot be in the future");
			}
		}

		// Filter out undefined values and handle empty strings
		const updateData = Object.fromEntries(
			Object.entries(body)
				.filter(([_, value]) => value !== undefined)
				.map(([key, value]) => [
					key,
					// Convert empty strings to null for certain fields
					(key === "slug" || key === "logo" || key === "headerImage" || key === "website") && value === ""
						? null
						: value,
				]),
		);

		// The display name and slug that key the city landing pages are copied from the
		// chosen `City` row rather than trusted from the client, so "Sarajevo" and
		// "Grad Sarajevo" cannot end up on two different pages. `null` clears all three.
		if (body.cityId !== undefined) {
			const cityColumns = body.cityId === null ? NO_CITY : await resolveClubCity(body.cityId);
			if (!cityColumns) {
				throw apiError.validation("Unknown city");
			}
			Object.assign(updateData, cityColumns);
		}

		// Always update timestamp
		updateData.updatedAt = new Date().toISOString();

		const updatedClub = await db.update(club).set(updateData).where(eq(club.id, clubId)).returning();

		if (!updatedClub[0]) {
			throw apiError.notFound("Club not found");
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				...body,
			},
			userId: context.user.id,
		});

		return response.json({
			success: true,
			club: { ...updatedClub[0], logoTile: logoTileOf(updatedClub[0].logoTile) },
		});
	},
	{
		auth: true,
		bustCache: ["clubs", "club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Update club information",
			description: "Update club information (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			body: updateClubBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					club: publicClubSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsCoreRouter.delete(
	"/clubs/:id",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const ownerMembershipData = await db
			.select()
			.from(clubMembership)
			.where(
				and(
					eq(clubMembership.clubId, clubId),
					eq(clubMembership.userId, context.user.id),
					eq(clubMembership.role, "CLUB_OWNER"),
				),
			)
			.limit(1);

		if (!ownerMembershipData[0]) {
			throw apiError.forbidden("Unauthorized - must be club owner");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const filesToDelete = [keyFromCdnUrl(clubData[0].logo), keyFromCdnUrl(clubData[0].headerImage)].filter(
			(key): key is string => key !== null,
		);

		if (filesToDelete.length > 0) {
			await deleteS3Files(filesToDelete, context.user.id);
		}

		await db.delete(club).where(eq(club.id, clubId));

		// ClubAuditLog rows cascade with the club, so a CLUB_DELETE audit row can never
		// survive the delete — log to telemetry instead.
		logger.emit({
			severityText: "info",
			body: "Club deleted",
			attributes: {
				clubId,
				clubName: clubData[0].name,
				userId: context.user.id,
			},
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		bustCache: ["clubs", "club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Delete club",
			description: "Delete a club (requires club owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
			mcpTool: true,
		},
	},
);

clubsCoreRouter.post(
	"/clubs/:id/logo/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const key = `club/${clubId}/logo`;
		const uploadUrl = await getS3UploadUrl(key, body.file.type, body.file.size);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club logo upload URL",
			description: "Get presigned S3 URL for uploading club logo",
			params: z.object({
				id: z.string(),
			}),
			body: clubLogoUploadBodySchema,
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsCoreRouter.post(
	"/clubs/:id/header-image/upload-url",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const key = `club/${clubId}/header`;
		const uploadUrl = await getS3UploadUrl(key, body.file.type, body.file.size);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club header image upload URL",
			description: "Get presigned S3 URL for uploading club header image",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				file: z.object({
					type: z.string().regex(/^image\//),
					size: z.number().max(MAX_UPLOAD_FILE_SIZE),
				}),
			}),
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsCoreRouter.delete(
	"/clubs/:id/logo",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const [existingLogoClub] = await db.select({ logo: club.logo }).from(club).where(eq(club.id, clubId)).limit(1);

		await db
			.update(club)
			.set({
				logo: null,
				logoTile: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		const logoKey = keyFromCdnUrl(existingLogoClub?.logo);
		if (logoKey) {
			await deleteS3Files([logoKey], context.user.id);
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				logoRemoved: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		bustCache: ["clubs", "club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Delete club logo",
			description: "Delete club logo (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsCoreRouter.delete(
	"/clubs/:id/header-image",
	async ({ params, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const managerMembershipData = await db
			.select({ role: clubMembership.role })
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.userId, context.user.id)))
			.limit(1);

		const managerMembership = managerMembershipData[0];

		if (!managerMembership || (managerMembership.role !== "MANAGER" && managerMembership.role !== "CLUB_OWNER")) {
			throw apiError.forbidden("Unauthorized - must be manager or owner");
		}

		const [existingHeaderClub] = await db
			.select({ headerImage: club.headerImage })
			.from(club)
			.where(eq(club.id, clubId))
			.limit(1);

		await db
			.update(club)
			.set({
				headerImage: null,
				updatedAt: new Date().toISOString(),
			})
			.where(eq(club.id, clubId));

		const headerKey = keyFromCdnUrl(existingHeaderClub?.headerImage);
		if (headerKey) {
			await deleteS3Files([headerKey], context.user.id);
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				headerImageRemoved: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		bustCache: ["clubs", "club:{id}"],
		schema: {
			tags: ["Clubs"],
			summary: "Delete club header image",
			description: "Delete club header image (requires manager or owner role)",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsCoreRouter.get(
	"/clubs/managed",
	async ({ context, response }) => {
		const managedClubs = await db
			.select({
				clubId: clubMembership.clubId,
				name: club.name,
				logo: club.logo,
				logoTile: club.logoTile,
			})
			.from(clubMembership)
			.leftJoin(club, eq(clubMembership.clubId, club.id))
			.where(
				and(
					eq(clubMembership.userId, context.user.id),
					or(eq(clubMembership.role, "MANAGER"), eq(clubMembership.role, "CLUB_OWNER")),
				),
			);

		return response.json({
			clubs: managedClubs.map((m) => ({
				id: m.clubId,
				name: m.name,
				logo: m.logo,
				logoTile: logoTileOf(m.logoTile),
			})),
		});
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get managed clubs",
			description: "Get list of club IDs managed by current user",
			mcpTool: true,
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							name: z.string().nullable(),
							logo: z.string().nullable(),
							logoTile: logoTileResponseSchema,
						}),
					),
				}),
				401: z.object({ error: z.string() }),
			},
		},
	},
);

clubsCoreRouter.get(
	"/clubs/:id/has-owner",
	async ({ params, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const ownerData = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		return response.json({ hasOwner: !!ownerData[0] });
	},
	{
		auth: false,
		schema: {
			tags: ["Clubs"],
			summary: "Check if club has owner",
			description: "Check if a club has an owner",
			params: z.object({
				id: z.string(),
			}),
			response: {
				200: z.object({
					hasOwner: z.boolean(),
				}),
				400: z.object({ error: z.string() }),
			},
		},
	},
);

export { clubsCoreRouter };
