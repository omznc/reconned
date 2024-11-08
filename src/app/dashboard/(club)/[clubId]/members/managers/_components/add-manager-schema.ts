import { z } from "zod";

export const promoteToManagerSchema = z.object({
	memberId: z.string().min(1, "Member ID is required"),
	clubId: z.string().min(1, "Club ID is required"),
});
