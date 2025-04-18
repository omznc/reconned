import { z } from "zod";

export const ruleSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1, "Ime je obavezno").max(100, "Ime može imati najviše 100 karaktera"),
	description: z.string().optional(),
	content: z.string(),
	clubId: z.string().min(1, "ID kluba je obavezan"),
});

export const deleteRuleSchema = z.object({
	ruleId: z.string().min(1, "ID pravila je obavezan"),
	clubId: z.string().min(1, "ID kluba je obavezan"),
});
