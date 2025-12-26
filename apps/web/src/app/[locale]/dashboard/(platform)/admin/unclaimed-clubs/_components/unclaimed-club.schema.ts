import { useExtracted } from "next-intl";
import * as z from "zod";

export function useCreateUnclaimedClubSchema() {
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
		location: z.string().max(50).optional(),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		description: z.string().max(5000).optional(),
		slug: z.string().optional(),
		dateFounded: z
			.date()
			.optional()
			.refine(
				(date) => {
					if (!date) return true; // Allow empty/undefined
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
		website: z.string().optional(),
		instagramUsername: z.string().optional(),
	});
}
