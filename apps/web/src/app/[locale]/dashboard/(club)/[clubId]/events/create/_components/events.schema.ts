import { useExtracted } from "next-intl";
import * as z from "zod";
import { normalizeMapData } from "@/components/map-editor/map-data";
import type { MapEditorSnapshot } from "@/components/map-editor/types";

const matcher = /<iframe.*?src="([^"]+)"/;

const mapDataSchema: z.ZodType<MapEditorSnapshot> = z.any().transform((value) => normalizeMapData(value));

export function useCreateEventFormSchema() {
	const t = useExtracted();

	return z
		.object({
			eventId: z.string().optional(),
			clubId: z.string({
				message: t("Event must be associated with a club"),
			}),
			name: z.string().min(1, {
				message: t("Event must have a name"),
			}),
			description: z.string().min(1, {
				message: t("Event must have a description"),
			}),
			costPerPerson: z
				.number()
				.gte(0, t("Event cannot have negative cost"))
				.lte(300, t("Event cannot have cost greater than 300")),
			location: z.string({
				message: t("Event must have a location"),
			}),
			googleMapsLink: z
				.string()
				.transform((input) => {
					const iframeMatch = input.match(matcher);
					if (iframeMatch) {
						return iframeMatch[1];
					}
					return input;
				})
				.optional(),
			dateStart: z.date({
				message: t("Event must have a start date"),
			}),
			dateEnd: z.date({
				message: t("Event must have an end date"),
			}),
			dateRegistrationsOpen: z.date({
				message: t("Event must have a registration opening date"),
			}),
			dateRegistrationsClose: z.date({
				message: t("Event must have a registration closing date"),
			}),
			slug: z.string().optional(),
			image: z.string().optional().optional(),
			isPrivate: z.boolean().optional(),
			allowFreelancers: z.boolean().optional(),
			hasBreakfast: z.boolean().optional(),
			hasLunch: z.boolean().optional(),
			hasDinner: z.boolean().optional(),
			hasSnacks: z.boolean().optional(),
			hasDrinks: z.boolean().optional(),
			hasPrizes: z.boolean().optional(),
			ruleIds: z.array(z.string()).optional(),
			mapData: mapDataSchema,
		})
		.refine((data) => data.dateEnd > data.dateStart, {
			message: t("End date must be after start date"),
			path: ["dateEnd"],
		})
		.refine(
			(data) => {
				const duration = data.dateEnd.getTime() - data.dateStart.getTime();
				const hourInMs = 60 * 60 * 1000;
				return duration >= hourInMs;
			},
			{
				message: t("Event must last at least 1 hour"),
				path: ["dateEnd"],
			},
		)
		.refine(
			(data) => {
				const hourBeforeEvent = new Date(data.dateStart.getTime() - 60 * 60 * 1000);
				return data.dateRegistrationsClose < hourBeforeEvent;
			},
			{
				message: t("Registrations must close at least 1 hour before event starts"),
				path: ["dateRegistrationsClose"],
			},
		)
		.refine(
			(data) => {
				if (!data.dateRegistrationsOpen) {
					return true;
				}
				return data.dateRegistrationsOpen < data.dateRegistrationsClose;
			},
			{
				message: t("Registration opening date must be before closing date"),
				path: ["dateRegistrationsOpen"],
			},
		)
		.refine(
			(data) => {
				if (!data.dateRegistrationsOpen) {
					return true;
				}
				return data.dateRegistrationsOpen <= data.dateStart;
			},
			{
				message: t("Registrations must open before event starts"),
				path: ["dateRegistrationsOpen"],
			},
		)
		.refine(
			(data) => {
				const maxDurationInMs = 7 * 24 * 60 * 60 * 1000; // 7 days
				const duration = data.dateEnd.getTime() - data.dateStart.getTime();
				return duration <= maxDurationInMs;
			},
			{
				message: t("Event cannot last longer than 7 days"),
				path: ["dateEnd"],
			},
		);
}

export const eventImageFileSchema = z.object({
	file: z.object({
		type: z.string().regex(/^image\//),
		size: z.number().max(1024 * 1024 * 4),
	}),
	eventId: z.string(),
	clubId: z.string(),
});

export const deleteEventImageSchema = z.object({
	eventId: z.string(),
	clubId: z.string(),
});

export const deleteEventSchema = deleteEventImageSchema.extend({
	clubId: z.string(),
});
