import { z } from "zod";

export const purchaseFormSchema = z.object({
	clubId: z.string(),
	title: z.string().min(1, "Naslov je obavezan"),
	description: z.string().optional(),
	amount: z.number().min(0, "Iznos mora biti pozitivan broj"),
});

export const editPurchaseFormSchema = purchaseFormSchema.extend({
	id: z.string(),
});

export type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;
export type EditPurchaseFormValues = z.infer<typeof editPurchaseFormSchema>;
