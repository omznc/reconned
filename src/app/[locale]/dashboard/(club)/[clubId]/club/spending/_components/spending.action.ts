"use server";

import { after } from "next/server";
import { z } from "zod";
import {
	purchaseFormSchema,
	purchaseReceiptSchema,
} from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { logClubAudit } from "@/lib/audit-logger";
import { generateSecureFilename } from "@/lib/file-security";
import { prisma } from "@/lib/prisma";
import { fileUploadRateLimit } from "@/lib/rate-limit";
import { safeActionClient } from "@/lib/safe-action";
import { deleteS3File, getS3FileUploadUrl } from "@/lib/storage";

export const createPurchase = safeActionClient.inputSchema(purchaseFormSchema).action(async ({ parsedInput }) => {
	if (parsedInput.receiptUrls && parsedInput.receiptUrls.length > 3) {
		return {
			serverError: "Maksimalno 3 računa po stavci",
		};
	}

	await logClubAudit({
		clubId: parsedInput.clubId,
		actionType: "SPENDING_CREATE",
		actionData: {
			title: parsedInput.title,
			description: parsedInput.description,
			amount: parsedInput.amount,
			receiptUrls: parsedInput.receiptUrls,
		},
	});

	const purchase = await prisma.clubPurchase.create({
		data: {
			...parsedInput,
		},
	});
	return { purchase };
});

export const updatePurchase = safeActionClient
	.inputSchema(purchaseFormSchema.extend({ id: z.string() }))
	.action(async ({ parsedInput }) => {
		if (parsedInput.receiptUrls && parsedInput.receiptUrls.length > 3) {
			return {
				serverError: "Maksimalno 3 računa po stavci",
			};
		}

		const purchase = await prisma.clubPurchase.update({
			where: { id: parsedInput.id },
			data: {
				title: parsedInput.title,
				description: parsedInput.description,
				amount: parsedInput.amount,
				receiptUrls: parsedInput.receiptUrls,
			},
		});

		await logClubAudit({
			clubId: purchase.clubId,
			actionType: "SPENDING_UPDATE",
			actionData: {
				id: purchase.id,
				title: parsedInput.title,
				description: parsedInput.description,
				amount: parsedInput.amount,
				receiptUrls: parsedInput.receiptUrls,
			},
		});

		return { data: { purchase } };
	});

export const deletePurchase = safeActionClient
	.inputSchema(z.object({ id: z.string(), clubId: z.string() }))
	.action(async ({ parsedInput }) => {
		const purchase = await prisma.clubPurchase.delete({
			where: { id: parsedInput.id },
		});

		after(async () => {
			const keys = purchase.receiptUrls
				.map((url) => url.split(".com/")[1])
				.filter((key): key is string => Boolean(key));
			await Promise.all(keys.map((key) => deleteS3File(key)));
		});

		await logClubAudit({
			clubId: parsedInput.clubId,
			actionType: "SPENDING_DELETE",
			actionData: {
				id: purchase.id,
			},
		});

		return { success: true };
	});

export const getPurchaseReceiptUploadUrl = safeActionClient
	.inputSchema(purchaseReceiptSchema)
	.action(async ({ parsedInput, ctx }) => {
		// Rate limiting - 10 file uploads per minute per user
		const rateLimitResult = await fileUploadRateLimit.limit(ctx.user.id);
		if (!rateLimitResult.success) {
			const resetTime = rateLimitResult.reset ? new Date(rateLimitResult.reset).toLocaleTimeString() : "soon";
			throw new ActionError(`Too many upload attempts. Try again at ${resetTime}.`);
		}

		// Generate secure filename
		const secureFilename = generateSecureFilename(parsedInput.file.name);
		const key = `receipt/${ctx.club?.id}/${secureFilename}`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
			clubId: ctx.club?.id,
			userId: ctx.user.id,
		});

		return resp;
	});

// const deleteReceipt = safeActionClient
// 	.inputSchema(
// 		z.object({
// 			purchaseId: z.string(),
// 			receiptUrl: z.string(),
// 		}),
// 	)
// 	.action(async ({ parsedInput }) => {
// 		const purchase = await prisma.clubPurchase.findUnique({
// 			where: { id: parsedInput.purchaseId },
// 			select: { receiptUrls: true },
// 		});

// 		if (!purchase) {
// 			throw new ActionError("Purchase not found");
// 		}

// 		const newUrls = purchase.receiptUrls.filter((url) => url !== parsedInput.receiptUrl);

// 		await prisma.clubPurchase.update({
// 			where: { id: parsedInput.purchaseId },
// 			data: { receiptUrls: newUrls },
// 		});

// 		// Extract the key from the URL and delete from S3
// 		const key = parsedInput.receiptUrl.split(".com/")[1];
// 		if (key) {
// 			await deleteS3File(key);
// 		}

// 		return { success: true };
// 	});
