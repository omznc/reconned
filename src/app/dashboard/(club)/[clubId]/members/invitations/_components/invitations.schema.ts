import { z } from "zod";

export const sendInvitationSchema = z.object({
	clubId: z.string(),
	userEmail: z.string(),
	userName: z.string().optional(),
});
