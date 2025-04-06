import { z } from "zod";

export const removeMemberSchema = z.object({
	memberId: z.string(),
	clubId: z.string(),
});

export const leaveClubSchema = z.object({
	clubId: z.string(),
});
