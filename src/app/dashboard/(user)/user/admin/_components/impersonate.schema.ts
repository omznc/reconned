import { z } from "zod";

export const impersonateSchema = z.object({
	userId: z.string().min(1),
});
