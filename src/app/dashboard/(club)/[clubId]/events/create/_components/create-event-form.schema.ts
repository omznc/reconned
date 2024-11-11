import { z } from "zod";

const matcher = /<iframe.*?src="([^"]+)"/;
export const createEventFormSchema = z
	.object({
		eventId: z.string().optional(),
		clubId: z.string({
			message: "Susret mora biti vezan za klub",
		}),
		name: z.string().min(1, {
			message: "Susret mora imati ime",
		}),
		description: z.string().min(1, {
			message: "Susret mora imati opis",
		}),
		costPerPerson: z.coerce
			.number()
			.gte(0, "Susret ne može imati negativnu cijenu")
			.lte(300, "Susret ne može imati cijenu veću od 300KM"),
		location: z.string({
			message: "Susret mora imati lokaciju",
		}),
		googleMapsLink: z
			.string()
			.transform((input) => {
				// Check for iframe tag and extract src if present
				const iframeMatch = input.match(matcher);
				if (iframeMatch) {
					return iframeMatch[1];
				}

				// If direct link is provided, return as-is
				return input;
			})
			.optional(),
		dateStart: z.coerce.date({
			message: "Susret mora imati datum početka",
		}),
		dateEnd: z.coerce.date({
			message: "Susret mora imati datum završetka",
		}),
		dateRegistrationsOpen: z.coerce.date({
			message: "Susret mora imati datum otvaranja prijava",
		}),
		dateRegistrationsClose: z.coerce.date({
			message: "Susret mora imati datum zatvaranja prijava",
		}),
		coverImage: z.string().optional().optional(),
		isPrivate: z.boolean().optional(),
		allowFreelancers: z.boolean().optional(),
		hasBreakfast: z.boolean().optional(),
		hasLunch: z.boolean().optional(),
		hasDinner: z.boolean().optional(),
		hasSnacks: z.boolean().optional(),
		hasDrinks: z.boolean().optional(),
		hasPrizes: z.boolean().optional(),
		mapData: z.object({
			areas: z.array(z.array(z.array(z.array(z.number())))),
			pois: z.array(
				z.object({
					lat: z.number(),
					lng: z.number(),
				}),
			),
		}),
	})
	.refine((data) => data.dateEnd > data.dateStart, {
		message: "Datum završetka mora biti nakon datuma početka",
		path: ["dateEnd"],
	})
	.refine(
		(data) => {
			const duration = data.dateEnd.getTime() - data.dateStart.getTime();
			const hourInMs = 60 * 60 * 1000;
			return duration >= hourInMs;
		},
		{
			message: "Susret mora trajati najmanje 1 sat",
			path: ["dateEnd"],
		},
	)
	.refine(
		(data) => {
			const hourBeforeEvent = new Date(
				data.dateStart.getTime() - 60 * 60 * 1000,
			);
			return data.dateRegistrationsClose < hourBeforeEvent;
		},
		{
			message:
				"Prijave se moraju zatvoriti najmanje 1 sat prije početka susreta",
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
			message:
				"Datum otvaranja prijava mora biti prije datuma zatvaranja prijava",
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
			message: "Prijave se moraju otvoriti prije početka susreta",
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
			message: "Susret ne može trajati duže od 7 dana",
			path: ["dateEnd"],
		},
	);

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
