import { z } from "zod";

export const requestAccessSchema = z.object({
	clubIdTarget: z.string().min(1, "Klub je obavezan"),
	message: z.string().optional(),
});

export type RequestAccessSchema = z.infer<typeof requestAccessSchema>;
