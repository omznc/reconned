import { z } from "zod";

export const purchaseFormSchema = z.object({
	clubId: z.string(),
	title: z.string().min(1, "Title is required"),
	description: z.string().optional(),
	amount: z.number().min(1, "Amount must be greater than 0"),
	receiptUrls: z.array(z.string()).max(3, "Maximum 3 receipts per item").optional(),
});

export const editPurchaseFormSchema = purchaseFormSchema.extend({
	id: z.string(),
});

export const purchaseReceiptSchema = z.object({
	clubId: z.string(),
	file: z.object({
		type: z.string().regex(/^(image\/|application\/pdf)/),
		size: z.number().max(1024 * 1024 * 5),
		name: z.string(),
	}),
});

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;
export type EditPurchaseFormValues = z.infer<typeof editPurchaseFormSchema>;
