import { useExtracted } from "next-intl";
import * as z from "zod";

export function useClubInfoSchema() {
	const t = useExtracted();

	return z.object({
		name: z
			.string()
			.min(1, {
				message: t("Club name is required"),
			})
			.max(50, {
				message: t("Club name must be shorter than 50 characters"),
			}),
		countryId: z.number({
			error: t("Country is required"),
		}),
		location: z
			.string()
			.min(1, {
				message: t("Club location is required"),
			})
			.max(50, {
				message: t("Club location must be shorter than 50 characters"),
			}),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		description: z.string().max(5000, {
			message: t("Club description must be shorter than 5000 characters"),
		}),
		slug: z.string().optional(),
		dateFounded: z.date().refine(
			(date) => {
				const today = new Date();
				today.setHours(23, 59, 59, 999); // End of today
				return date <= today;
			},
			{
				message: t("Date founded cannot be in the future"),
			},
		),
		isAllied: z.boolean().optional(),
		isPrivate: z.boolean().optional(),
		isPrivateStats: z.boolean().optional(),
		logo: z.string().optional(),
		headerImage: z.string().optional(),
		contactPhone: z.string().optional(),
		contactEmail: z.string().optional(),
		clubId: z.string().optional(),
		website: z.string().optional(),
		instagramUsername: z.string().optional(),
	});
}

export const clubLogoFileSchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 4),
	}),
	clubId: z.string(),
});

export const clubHeaderFileSchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 8),
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
