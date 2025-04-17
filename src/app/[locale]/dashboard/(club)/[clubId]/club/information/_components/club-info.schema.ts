import { z } from "zod";

export const clubInfoSchema = z.object({
	name: z
		.string()
		.min(1, {
			message: "Ime kluba je obavezno",
		})
		.max(50, {
			message: "Ime kluba mora biti kraće od 50 znakova",
		}),
	countryId: z.number({
		required_error: "Država je obavezna",
	}),
	location: z
		.string()
		.min(1, {
			message: "Lokacija kluba je obavezna",
		})
		.max(50, {
			message: "Lokacija kluba mora biti kraća od 50 znakova",
		}),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	description: z.string().max(5000, {
		message: "Opis kluba mora biti kraći od 5000 znakova",
	}),
	slug: z.string().optional(),
	dateFounded: z.coerce.date(),
	isAllied: z.boolean().optional(),
	isPrivate: z.boolean().optional(),
	isPrivateStats: z.boolean().optional(),
	logo: z.string().optional(),
	contactPhone: z.string().optional(),
	contactEmail: z.string().optional(),
	clubId: z.string().optional(),
	website: z.string().optional(),
	instagramUsername: z.string().optional(),
});

export const clubLogoFileSchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 4),
	}),
	clubId: z.string(),
});

export const deleteClubImageSchema = z.object({
	clubId: z.string(),
});

export const disconnectInstagramSchema = z.object({
	clubId: z.string(),
});

export const deleteClubSchema = deleteClubImageSchema;
