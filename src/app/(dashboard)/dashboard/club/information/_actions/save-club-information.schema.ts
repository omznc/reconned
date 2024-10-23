import { z } from "zod";

export const saveClubInformationSchema = z.object({
	name: z
		.string()
		.min(1, {
			message: "Ime kluba je obavezno",
		})
		.max(50, {
			message: "Ime kluba mora biti kraće od 50 znakova",
		}),
	location: z
		.string()
		.min(1, {
			message: "Lokacija kluba je obavezna",
		})
		.max(50, {
			message: "Lokacija kluba mora biti kraća od 50 znakova",
		}),
	description: z.string().max(5000, {
		message: "Opis kluba mora biti kraći od 5000 znakova",
	}),
	dateFounded: z.coerce.date(),
	isAllied: z.boolean(),
	isPrivate: z.boolean(),
	logo: z.string().optional(),
	contactPhone: z.string().optional(),
	contactEmail: z.string().optional(),
});
