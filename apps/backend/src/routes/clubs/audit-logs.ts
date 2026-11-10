import { apiError, Router, responseSchema } from "@reconned/router";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import * as z from "zod";
import { clubAuditLog, user } from "../../drizzle/schema";
import { requireClubManager } from "../../lib/club-access";
import { db } from "../../lib/db";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";

const clubsAuditLogsRouter = new Router();

clubsAuditLogsRouter.get(
	"/clubs/:id/audit-logs",
	async ({ params, context, query, response }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		await requireClubManager(clubId, context.user.id);

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;
		const search = query?.search || "";
		const actionType = query?.actionType;

		const whereConditions = [eq(clubAuditLog.clubId, clubId)];

		if (actionType) {
			whereConditions.push(eq(clubAuditLog.actionType, actionType));
		}

		if (search) {
			// Restricted to actionType. The previous variant also matched
			// CAST(actionData AS TEXT) ILIKE '%...%', which re-serialized the jsonb payload
			// for every row in the club's audit log and could not use any index. actionType
			// is a plain text column and is trigram-indexable.
			whereConditions.push(ilike(clubAuditLog.actionType, `%${search}%`));
		}

		const whereClause = and(...whereConditions);

		const logs = await db
			.select({
				id: clubAuditLog.id,
				createdAt: clubAuditLog.createdAt,
				userId: clubAuditLog.userId,
				clubId: clubAuditLog.clubId,
				actionType: clubAuditLog.actionType,
				actionData: clubAuditLog.actionData,
				ipAddress: clubAuditLog.ipAddress,
				userAgent: clubAuditLog.userAgent,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
				},
			})
			.from(clubAuditLog)
			.leftJoin(user, eq(clubAuditLog.userId, user.id))
			.where(whereClause)
			.orderBy(desc(clubAuditLog.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(clubAuditLog).where(whereClause);
		const total = totalData[0]?.count || 0;

		return response.json({
			logs: logs.map((log) => ({
				...log,
				actionData: log.actionData as Record<string, unknown>,
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
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club audit logs",
			description: "Get audit logs for a club with pagination, search, and filtering by action type",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema.extend({
				search: z.string().max(100).optional(),
				actionType: z.string().optional(),
			}),
			response: {
				200: z.object({
					logs: z.array(
						z.object({
							id: z.string(),
							createdAt: z.string(),
							userId: z.string().nullable(),
							clubId: z.string(),
							actionType: z.string(),
							actionData: z.record(z.string(), z.unknown()),
							ipAddress: z.string().nullable(),
							userAgent: z.string().nullable(),
							user: z
								.object({
									id: z.string(),
									name: z.string(),
									email: z.string(),
								})
								.nullable(),
						}),
					),
					pagination: paginationResponseSchema,
				}),
				...responseSchema([400, 401, 403], z.object({ error: z.string() })),
			},
		},
	},
);

export { clubsAuditLogsRouter };
