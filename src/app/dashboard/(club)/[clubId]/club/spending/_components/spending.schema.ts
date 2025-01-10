import { z } from "zod";

export const purchaseFormSchema = z.object({
	clubId: z.string(),
	title: z.string().min(1, "Naslov je obavezan"),
	description: z.string().optional(),
	amount: z.number().min(1, "Iznos mora biti veći od 0"),
	receiptUrls: z
		.array(z.string())
		.max(3, "Maksimalno 3 računa po stavci")
		.optional(),
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
