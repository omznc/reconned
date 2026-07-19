import { apiError, Router } from "@reconned/router";
import { and, count, desc, eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { clubMembership, clubPurchase } from "../../drizzle/schema";
import { logClubAudit } from "../../lib/audit-logger";
import { db } from "../../lib/db";
import { paginationQuerySchema, paginationResponseSchema } from "../../lib/schemas";
import { deleteS3Files, getS3UploadUrl } from "../../lib/storage";

const clubsPurchasesRouter = new Router();

const baseClubPurchaseSchema = createSelectSchema(clubPurchase);

const createPurchaseBodySchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	amount: z.number().min(0.01),
	receiptUrls: z.array(z.url()).max(3).optional(),
});

const updatePurchaseBodySchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	amount: z.number().min(0.01).optional(),
	receiptUrls: z.array(z.url()).max(3).optional(),
});

clubsPurchasesRouter.get(
	"/clubs/:id/purchases",
	async ({ params, response, context, query }) => {
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

		const { page, perPage } = query;
		const offset = (page - 1) * perPage;

		const purchases = await db
			.select()
			.from(clubPurchase)
			.where(eq(clubPurchase.clubId, clubId))
			.orderBy(desc(clubPurchase.createdAt))
			.limit(perPage)
			.offset(offset);

		const totalData = await db.select({ count: count() }).from(clubPurchase).where(eq(clubPurchase.clubId, clubId));

		const total = totalData[0]?.count || 0;

		return response.json({
			purchases,
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
			summary: "Get club purchases",
			description: "Get paginated purchases for a club",
			params: z.object({
				id: z.string(),
			}),
			query: paginationQuerySchema,
			mcpTool: true,
			response: {
				200: z.object({
					purchases: z.array(baseClubPurchaseSchema),
					pagination: paginationResponseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
			},
		},
	},
);

clubsPurchasesRouter.get(
	"/clubs/:id/purchases/:purchaseId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const purchaseId = params.purchaseId;

		if (!clubId || !purchaseId) {
			throw apiError.validation("Club ID and Purchase ID are required");
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

		const purchaseData = await db
			.select()
			.from(clubPurchase)
			.where(and(eq(clubPurchase.id, purchaseId), eq(clubPurchase.clubId, clubId)))
			.limit(1);

		if (!purchaseData[0]) {
			throw apiError.notFound("Purchase not found");
		}

		return response.json({ purchase: purchaseData[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get club purchase",
			description: "Get a specific purchase for a club",
			params: z.object({
				id: z.string(),
				purchaseId: z.string(),
			}),
			response: {
				200: z.object({
					purchase: baseClubPurchaseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsPurchasesRouter.post(
	"/clubs/:id/purchases",
	async ({ params, response, context, body }) => {
		const clubId = params.id;

		if (!clubId) {
			throw apiError.validation("Club ID is required");
		}

		if (body.receiptUrls && body.receiptUrls.length > 3) {
			throw apiError.validation("Maximum 3 receipts per item");
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

		const purchaseId = crypto.randomUUID();

		const newPurchase = await db
			.insert(clubPurchase)
			.values({
				id: purchaseId,
				clubId,
				title: body.title,
				description: body.description || null,
				amount: body.amount,
				receiptUrls: body.receiptUrls || [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			})
			.returning();

		if (!newPurchase[0]) {
			throw apiError.internal("Failed to create purchase");
		}

		await logClubAudit({
			clubId,
			actionType: "PURCHASE_CREATE",
			actionData: {
				title: body.title,
				description: body.description,
				amount: body.amount,
				receiptUrls: body.receiptUrls,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, purchase: newPurchase[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Create club purchase",
			description: "Create a new purchase for a club",
			params: z.object({
				id: z.string(),
			}),
			body: createPurchaseBodySchema,
			mcpTool: true,
			response: {
				200: z.object({
					success: z.boolean(),
					purchase: baseClubPurchaseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				500: z.object({ error: z.string() }),
			},
		},
	},
);

clubsPurchasesRouter.put(
	"/clubs/:id/purchases/:purchaseId",
	async ({ params, response, context, body }) => {
		const clubId = params.id;
		const purchaseId = params.purchaseId;

		if (!clubId || !purchaseId) {
			throw apiError.validation("Club ID and Purchase ID are required");
		}

		if (body.receiptUrls && body.receiptUrls.length > 3) {
			throw apiError.validation("Maximum 3 receipts per item");
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

		const purchaseData = await db
			.select()
			.from(clubPurchase)
			.where(and(eq(clubPurchase.id, purchaseId), eq(clubPurchase.clubId, clubId)))
			.limit(1);

		if (!purchaseData[0]) {
			throw apiError.notFound("Purchase not found");
		}

		const updatedPurchase = await db
			.update(clubPurchase)
			.set({
				title: body.title,
				description: body.description || null,
				amount: body.amount,
				receiptUrls: body.receiptUrls || [],
				updatedAt: new Date().toISOString(),
			})
			.where(eq(clubPurchase.id, purchaseId))
			.returning();

		if (!updatedPurchase[0]) {
			throw apiError.internal("Failed to update purchase");
		}

		await logClubAudit({
			clubId,
			actionType: "PURCHASE_UPDATE",
			actionData: {
				id: updatedPurchase[0].id,
				title: body.title,
				description: body.description,
				amount: body.amount,
				receiptUrls: body.receiptUrls,
			},
			userId: context.user.id,
		});

		return response.json({ success: true, purchase: updatedPurchase[0] });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Update club purchase",
			description: "Update an existing purchase for a club",
			params: z.object({
				id: z.string(),
				purchaseId: z.string(),
			}),
			body: updatePurchaseBodySchema,
			response: {
				200: z.object({
					success: z.boolean(),
					purchase: baseClubPurchaseSchema,
				}),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsPurchasesRouter.delete(
	"/clubs/:id/purchases/:purchaseId",
	async ({ params, response, context }) => {
		const clubId = params.id;
		const purchaseId = params.purchaseId;

		if (!clubId || !purchaseId) {
			throw apiError.validation("Club ID and Purchase ID are required");
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

		const purchaseData = await db
			.select()
			.from(clubPurchase)
			.where(and(eq(clubPurchase.id, purchaseId), eq(clubPurchase.clubId, clubId)))
			.limit(1);

		if (!purchaseData[0]) {
			throw apiError.notFound("Purchase not found");
		}

		if (purchaseData[0].receiptUrls && purchaseData[0].receiptUrls.length > 0) {
			const receiptKeys = purchaseData[0].receiptUrls.map((url) => {
				const urlObj = new URL(url);
				return urlObj.pathname.substring(1);
			});
			await deleteS3Files(receiptKeys, context.user.id);
		}

		await db.delete(clubPurchase).where(eq(clubPurchase.id, purchaseId));

		await logClubAudit({
			clubId,
			actionType: "PURCHASE_DELETE",
			actionData: {
				id: purchaseId,
			},
			userId: context.user.id,
		});

		return response.json({ success: true });
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Delete club purchase",
			description: "Delete a purchase from a club",
			params: z.object({
				id: z.string(),
				purchaseId: z.string(),
			}),
			response: {
				200: z.object({ success: z.boolean() }),
				400: z.object({ error: z.string() }),
				401: z.object({ error: z.string() }),
				403: z.object({ error: z.string() }),
				404: z.object({ error: z.string() }),
			},
		},
	},
);

clubsPurchasesRouter.post(
	"/clubs/:id/purchases/receipts/upload-url",
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

		const secureFilename = `${Date.now()}_${body.file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
		const key = `receipt/${clubId}/${secureFilename}`;

		try {
			const result = await getS3UploadUrl(key, body.file.type, body.file.size, context.user.id);
			return response.json(result);
		} catch (error) {
			throw apiError.internal(error instanceof Error ? error.message : "Failed to generate upload URL");
		}
	},
	{
		auth: true,
		schema: {
			tags: ["Clubs"],
			summary: "Get purchase receipt upload URL",
			description: "Get a presigned S3 URL for uploading a purchase receipt",
			params: z.object({
				id: z.string(),
			}),
			body: z.object({
				file: z.object({
					name: z.string(),
					type: z.string(),
					size: z.number(),
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

export { clubsPurchasesRouter };
