import { z } from "zod";

export const passwordSchema = z
	.object({
		currentPassword: z.string().min(1, "Trenutna lozinka je obavezna"),
		confirmPassword: z.string().min(1, "Potvrda lozinke je obavezna"),
		newPassword: z
			.string()
			.min(8, "Nova lozinka mora imati najmanje 8 znakova"),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Lozinke se ne podudaraju",
		path: ["confirmPassword"],
	});
