import { coerce, number, z } from "zod";

export const createEventFormSchema = z.object({
	name: z.string({
		message: "Susret mora imati ime",
	}),
	description: z.string({
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
		.url({
			message: "Google Maps link nije validan",
		})
		.optional(),
	dateStart: z.coerce.date({
		message: "Susret mora imati datum početka",
	}),
	dateEnd: z.coerce.date({
		message: "Susret mora imati datum završetka",
	}),
	dateRegistrationsOpen: z.coerce.date().optional(),
	dateRegistrationsClose: z.coerce.date({
		message: "Susret mora imati datum zatvaranja prijava",
	}),
	isPrivate: z.boolean(),
	allowFreelancers: z.boolean(),
	hasBreakfast: z.boolean(),
	hasLunch: z.boolean(),
	hasDinner: z.boolean(),
	hasSnacks: z.boolean(),
	hasDrinks: z.boolean(),
	hasPrizes: z.boolean(),
});
