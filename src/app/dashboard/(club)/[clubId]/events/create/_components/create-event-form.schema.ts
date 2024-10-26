import { z } from "zod";

// Schema for a single point of interest (POI)
const poiSchema = z.object({
	lat: z.number(), // Latitude
	lng: z.number(), // Longitude
});

// Schema for coordinates (latitude and longitude pair)
const coordinatesSchema = z.array(z.number()); // Array of numbers

// Schema for areas, which are arrays of arrays of coordinates
const areaSchema = z.array(z.array(z.array(coordinatesSchema))); // Adjusted to reflect the nested arrays

export const createEventFormSchema = z.object({
	id: z.string().optional(),
	clubId: z.string({
		message: "Susret mora biti vezan za klub",
	}),
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
		.transform((input) => {
			// Check for iframe tag and extract src if present
			const iframeMatch = input.match(/<iframe.*?src="([^"]+)"/);
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
	dateRegistrationsOpen: z.coerce.date().optional(),
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
});

export const eventImageFileSchema = z.object({
	file: z.instanceof(File).refine((file) => {
		if (!file.type.startsWith("image/")) {
			throw new Error("Morate odabrati sliku");
		}

		// Only allow images up to 4MB
		if (file.size > 1024 * 1024 * 4) {
			throw new Error("Slika mora biti manja od 4MB");
		}

		return true;
	}),
	id: z.string(),
});

export const deleteEventImageSchema = z.object({
	id: z.string(),
});
