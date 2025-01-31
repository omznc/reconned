import { z } from "zod";

export const requestAccessSchema = z.object({
	// This can't be called clubId because the safeActionClient will think that the person needs to be a manager.
	clubIdTarget: z.string().min(1, "Klub je obavezan"),
	message: z.string().optional(),
});

export type RequestAccessSchema = z.infer<typeof requestAccessSchema>;
