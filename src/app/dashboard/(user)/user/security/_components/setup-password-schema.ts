import { z } from "zod";

export const setupPasswordSchema = z.object({
	password: z.string().min(8, {
		message: "Lozinka mora sadržavati najmanje 8 znakova",
	}),
});
