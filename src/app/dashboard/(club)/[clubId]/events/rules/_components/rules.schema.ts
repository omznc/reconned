import { z } from "zod";

export const ruleSchema = z.object({
	id: z.string().optional(),
	name: z
		.string()
		.min(1, "Ime je obavezno")
		.max(100, "Ime može imati najviše 100 karaktera"),
	description: z.string().optional(),
	content: z
		.object({
			type: z.string().min(1, "Tip je obavezan"),
			content: z.array(z.any()),
		})
		.transform((val) => JSON.parse(JSON.stringify(val))), // Ensure proper serialization
	clubId: z.string().min(1, "ID kluba je obavezan"),
});

export const deleteRuleSchema = z.object({
	ruleId: z.string().min(1, "ID pravila je obavezan"),
	clubId: z.string().min(1, "ID kluba je obavezan"),
});
