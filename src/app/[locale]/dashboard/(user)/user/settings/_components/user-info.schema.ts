import { z } from "zod";

export const userInfoShema = z.object({
	name: z.string().min(1).max(50),
	email: z.string().email(),
	isPrivate: z.boolean(),
	isPrivateEmail: z.boolean(),
	isPrivatePhone: z.boolean(),
	isPrivateStats: z.boolean(),
	image: z.string().optional(),
	bio: z.string().max(200),
	location: z.string().optional(),
	website: z.string().optional(),
	phone: z.string().optional(),
	callsign: z.string().optional(),
	slug: z.string().optional(),
});

export const userImageFileSchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 4),
		dimensions: z
			.object({
				width: z.number(),
				height: z.number(),
			})
			.refine(
				(data) => {
					return Math.abs(data.width - data.height) <= 10;
				},
				{
					message: "Slika mora biti kvadratnog oblika (1:1).",
				},
			),
	}),
});
