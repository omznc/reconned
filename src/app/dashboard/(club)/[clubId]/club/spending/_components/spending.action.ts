"use server";

import { prisma } from "@/lib/prisma";
import { purchaseFormSchema } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { safeActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const createPurchase = safeActionClient
	.schema(purchaseFormSchema)
	.action(async ({ parsedInput }) => {
		const purchase = await prisma.purchases.create({
			data: {
				...parsedInput,
			},
		});
		return { purchase };
	});

export const updatePurchase = safeActionClient
	.schema(purchaseFormSchema.extend({ id: z.string() }))
	.action(async ({ parsedInput }) => {
		const purchase = await prisma.purchases.update({
			where: { id: parsedInput.id },
			data: {
				title: parsedInput.title,
				description: parsedInput.description,
				amount: parsedInput.amount,
			},
		});
		return { purchase };
	});

export const deletePurchase = safeActionClient
	.schema(z.object({ id: z.string(), clubId: z.string() }))
	.action(async ({ parsedInput }) => {
		await prisma.purchases.delete({
			where: { id: parsedInput.id },
		});
		return { success: true };
	});
