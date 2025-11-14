import { z } from "zod";

export const createUnclaimedClubSchema = z.object({
	name: z
		.string()
		.min(1, {
			message: "Ime kluba je obavezno",
		})
		.max(50, {
			message: "Ime kluba mora biti kraće od 50 znakova",
		}),
	countryId: z.number({
		error: "Država je obavezna",
	}),
	location: z.string().max(50).optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	description: z.string().max(5000).optional(),
	slug: z.string().optional(),
	dateFounded: z.date().optional(),
	isAllied: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isPrivateStats: z.boolean().optional(),
	logo: z.string().optional(),
	contactPhone: z.string().optional(),
	contactEmail: z.string().optional(),
	website: z.string().optional(),
	instagramUsername: z.string().optional(),
});
