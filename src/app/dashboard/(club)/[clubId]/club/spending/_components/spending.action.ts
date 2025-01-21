"use server";

import { prisma } from "@/lib/prisma";
import {
	purchaseFormSchema,
	purchaseReceiptSchema,
} from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";
import { getS3FileUploadUrl, deleteS3File } from "@/lib/storage";
import { randomUUID } from "node:crypto";
import { after } from "next/server";

export const createPurchase = safeActionClient
	.schema(purchaseFormSchema)
	.action(async ({ parsedInput }) => {
		if (parsedInput.receiptUrls && parsedInput.receiptUrls.length > 3) {
			return {
				serverError: "Maksimalno 3 računa po stavci",
			};
		}

		const purchase = await prisma.clubPurchase.create({
			data: {
				...parsedInput,
			},
		});
		return { purchase };
	});

export const updatePurchase = safeActionClient
	.schema(purchaseFormSchema.extend({ id: z.string() }))
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
		return { data: { purchase } };
	});

export const deletePurchase = safeActionClient
	.schema(z.object({ id: z.string(), clubId: z.string() }))
	.action(async ({ parsedInput }) => {
		const purchase = await prisma.clubPurchase.delete({
			where: { id: parsedInput.id },
		});

		after(async () => {
			const keys = purchase.receiptUrls.map((url) => url.split(".com/")[1]);
			await Promise.all(keys.map((key) => deleteS3File(key!)));
		});

		return { success: true };
	});

export const getPurchaseReceiptUploadUrl = safeActionClient
	.schema(purchaseReceiptSchema)
	.action(async ({ parsedInput, ctx }) => {
		const uuid = randomUUID();
		const key = `receipt/${ctx.club?.id}/${uuid}-${parsedInput.file.name}`;

		const resp = await getS3FileUploadUrl({
			type: parsedInput.file.type,
			size: parsedInput.file.size,
			key,
		});

		return resp;
	});

export const deleteReceipt = safeActionClient
	.schema(
		z.object({
			purchaseId: z.string(),
			receiptUrl: z.string(),
		}),
	)
	.action(async ({ parsedInput }) => {
		const purchase = await prisma.clubPurchase.findUnique({
			where: { id: parsedInput.purchaseId },
			select: { receiptUrls: true },
		});

		if (!purchase) {
			throw new Error("Purchase not found");
		}

		const newUrls = purchase.receiptUrls.filter(
			(url) => url !== parsedInput.receiptUrl,
		);

		await prisma.clubPurchase.update({
			where: { id: parsedInput.purchaseId },
			data: { receiptUrls: newUrls },
		});

		// Extract the key from the URL and delete from S3
		const key = parsedInput.receiptUrl.split(".com/")[1];
		if (key) {
			await deleteS3File(key);
		}

		return { success: true };
	});
