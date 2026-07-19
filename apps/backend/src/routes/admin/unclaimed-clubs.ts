import { render } from "@react-email/components";
import { apiError, Router, responseSchema } from "@reconned/router";
import { randomUUIDv7 } from "bun";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership, user } from "../../drizzle/schema";
import ClubOwnerAssignedEmail from "../../emails/club-owner-assigned";
import { logClubAudit } from "../../lib/audit-logger";
import { db } from "../../lib/db";
import { getEmailMessages, interpolateMessage } from "../../lib/email-messages";
import { env } from "../../lib/env";
import { isValidLanguage } from "../../lib/i18n";
import { sendEmail } from "../../lib/mail";
import { logger, posthog } from "../../lib/posthog";
import { httpsUrl, paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";
import { getS3UploadUrl } from "../../lib/storage";

const adminUnclaimedClubsRouter = new Router();

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
	instagramConnected: z.boolean(),
	instagramBusinessId: z.string().nullable(),
	countryId: z.number().nullable(),
	banned: z.boolean().nullable(),
	banReason: z.string().nullable(),
	banExpires: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	headerImage: z.string().nullable(),
});

const uploadFileSchema = z.object({
	file: z.object({
		type: z.string(),
		size: z.number().min(1),
	}),
});

adminUnclaimedClubsRouter.get(
	"/admin/unclaimed-clubs",
	async ({ query, response, context: _context }) => {
		const { page = 1, perPage = 25, search = "", sortBy = "createdAt", sortOrder = "desc" } = query || {};
		const offset = (page - 1) * perPage;

		const whereConditions = [];

		if (search) {
			whereConditions.push(or(ilike(club.name, `%${search}%`), ilike(club.location, `%${search}%`)));
		}

		// Correlated NOT EXISTS instead of loading every owner membership into an IN (...) list.
		whereConditions.push(
			sql`NOT EXISTS (
				SELECT 1
				FROM "ClubMembership" cm
				WHERE cm."clubId" = ${club.id}
				AND cm."role" = 'CLUB_OWNER'
			)`,
		);

		const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;

		let orderBy: typeof club.name | typeof club.location | typeof club.createdAt | ReturnType<typeof desc>;
		if (sortBy === "name") {
			orderBy = sortOrder === "desc" ? desc(club.name) : club.name;
		} else if (sortBy === "location") {
			orderBy = sortOrder === "desc" ? desc(club.location) : club.location;
		} else {
			orderBy = sortOrder === "desc" ? desc(club.createdAt) : club.createdAt;
		}

		const [clubs, total] = await Promise.all([
			db.select().from(club).where(where).orderBy(orderBy).limit(perPage).offset(offset),
			db.select({ count: count() }).from(club).where(where),
		]);

		const clubIds = clubs.map((c) => c.id);

		// Single grouped count for the whole page instead of one query per club.
		const memberCounts = clubIds.length
			? await db
					.select({ clubId: clubMembership.clubId, count: count() })
					.from(clubMembership)
					.where(inArray(clubMembership.clubId, clubIds))
					.groupBy(clubMembership.clubId)
			: [];

		const memberCountMap = new Map(memberCounts.map((r) => [r.clubId, Number(r.count)]));

		const clubsWithCounts = clubs.map((c) => ({
			...c,
			_count: {
				members: memberCountMap.get(c.id) || 0,
			},
		}));

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

adminUnclaimedClubsRouter.get(
	"/admin/unclaimed-clubs/:id",
	async ({ params, response, context: _context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
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

adminUnclaimedClubsRouter.post(
	"/admin/unclaimed-clubs",
	async ({ body, response, context }) => {
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
			throw apiError.internal("Failed to create club");
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

		// Track club creation by admin
		posthog.capture({
			distinctId: context.user.id,
			event: "club_created_by_admin",
			properties: {
				club_id: newClub[0].id,
				club_name: body.name,
				location: body.location,
				country_id: body.countryId,
				is_private: body.isPrivate || false,
				slug: body.slug,
				admin_action: true,
			},
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
				contactEmail: z.string().email().or(z.literal("")).optional(),
				website: httpsUrl.optional(),
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

adminUnclaimedClubsRouter.put(
	"/admin/unclaimed-clubs/:id",
	async ({ params, body, response, context }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const existingClub = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!existingClub[0]) {
			throw apiError.notFound("Club not found");
		}

		const updateData: Record<string, unknown> = {
			updatedAt: new Date().toISOString(),
		};

		const updatableFields = [
			"name",
			"countryId",
			"location",
			"latitude",
			"longitude",
			"description",
			"slug",
			"dateFounded",
			"isAllied",
			"isPrivate",
			"isPrivateStats",
			"logo",
			"headerImage",
			"contactPhone",
			"contactEmail",
			"website",
			"instagramUsername",
		] as const;

		for (const field of updatableFields) {
			if (body[field] !== undefined) {
				updateData[field] = body[field];
			}
		}

		const updatedClub = await db.update(club).set(updateData).where(eq(club.id, clubId)).returning();

		if (!updatedClub[0]) {
			throw apiError.notFound("Club not found");
		}

		await logClubAudit({
			clubId,
			actionType: "CLUB_UPDATE",
			actionData: {
				updatedByAdmin: true,
				unclaimed: true,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Update unclaimed club",
			description: "Admin endpoint to update unclaimed club details",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				name: z.string().min(1).optional(),
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
				logo: z.string().optional(),
				headerImage: z.string().optional(),
				contactPhone: z.string().optional(),
				contactEmail: z.string().email().or(z.literal("")).optional(),
				website: httpsUrl.optional(),
				instagramUsername: z.string().optional(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				...responseSchema([400, 401, 403, 404, 500], z.object({ error: z.string() })),
			},
		},
	},
);

adminUnclaimedClubsRouter.put(
	"/admin/unclaimed-clubs/:id/logo",
	async ({ params, body, response, context: _context }) => {
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

adminUnclaimedClubsRouter.post(
	"/admin/unclaimed-clubs/:id/logo/upload-url",
	async ({ params, body, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select({ id: club.id }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const uploadUrl = await getS3UploadUrl(`club/${clubId}/logo`, body.file.type, body.file.size, context.user.id);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get upload URL for unclaimed club logo",
			description: "Presigned URL for uploading unclaimed club logo",
			params: z.object({
				id: z.string(),
			}),
			body: uploadFileSchema,
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminUnclaimedClubsRouter.put(
	"/admin/unclaimed-clubs/:id/header-image",
	async ({ params, body, response, context: _context }) => {
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

adminUnclaimedClubsRouter.post(
	"/admin/unclaimed-clubs/:id/header-image/upload-url",
	async ({ params, body, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select({ id: club.id }).from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const uploadUrl = await getS3UploadUrl(
			`club/${clubId}/header`,
			body.file.type,
			body.file.size,
			context.user.id,
		);

		return response.json(uploadUrl);
	},
	{
		auth: true,
		schema: {
			tags: ["Admin"],
			summary: "Get upload URL for unclaimed club header image",
			description: "Presigned URL for uploading unclaimed club header image",
			params: z.object({
				id: z.string(),
			}),
			body: uploadFileSchema,
			response: {
				200: z.object({
					url: z.string(),
					cdnUrl: z.string(),
					key: z.string(),
				}),
				...responseSchema([400, 401, 403, 404], z.object({ error: z.string() })),
			},
		},
	},
);

adminUnclaimedClubsRouter.post(
	"/admin/unclaimed-clubs/:id/assign-owner",
	async ({ params, body, response, context }) => {
		const clubId = params.id;
		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		const clubData = await db.select().from(club).where(eq(club.id, clubId)).limit(1);

		if (!clubData[0]) {
			throw apiError.notFound("Club not found");
		}

		const existingOwner = await db
			.select()
			.from(clubMembership)
			.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.role, "CLUB_OWNER")))
			.limit(1);

		if (existingOwner[0]) {
			throw apiError.validation("Club already has an owner");
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

		const newOwner = await db
			.select({ name: user.name, email: user.email, language: user.language })
			.from(user)
			.where(eq(user.id, body.userId))
			.limit(1);

		if (newOwner[0]) {
			try {
				const language = isValidLanguage(newOwner[0].language) ? newOwner[0].language : "bs";
				const messages = getEmailMessages(language);
				const clubDashboardUrl = `${env.FRONTEND_URL}/dashboard/${clubId}/club`;

				await sendEmail({
					to: newOwner[0].email,
					subject: interpolateMessage(messages.emails.clubOwnerAssigned.subject, {
						clubName: clubData[0].name,
					}),
					html: await render(
						ClubOwnerAssignedEmail({
							userName: newOwner[0].name,
							clubName: clubData[0].name,
							clubLogo: clubData[0].logo,
							clubUrl: clubDashboardUrl,
							language,
						}),
						{ pretty: true },
					),
				});

				posthog.capture({
					distinctId: context.user.id,
					event: "club_owner_assigned_email_sent",
					properties: {
						recipient_email: newOwner[0].email,
						club_id: clubId,
						club_name: clubData[0].name,
						assigned_to_user_id: body.userId,
						language,
					},
				});
			} catch (error) {
				logger.emit({
					severityText: "error",
					body: "Failed to send club owner assignment email",
					attributes: {
						error: error instanceof Error ? error.message : String(error),
						club_id: clubId,
						club_name: clubData[0]?.name,
						recipient_email: newOwner[0].email,
						assigned_by: context.user.id,
						request_id: context.requestId,
					},
				});
			}
		}

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

export { adminUnclaimedClubsRouter };
