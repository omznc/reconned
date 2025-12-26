import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { country } from "../drizzle/schema";
import { db } from "../lib/db";
import { Router } from "../lib/router";

const VALID_LOCALES = ["en", "bs", "sr"];

const countrySchema = z.object({
	id: z.number(),
	name: z.string(),
	emoji: z.string().nullable(),
	iso2: z.string(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	translations: z.record(z.string(), z.string()).nullable().optional(),
});

export const countriesRouter = new Router();

countriesRouter.get(
	"/countries",
	async ({ response }) => {
		const countries = await db
			.select({
				id: country.id,
				name: country.name,
				emoji: country.emoji,
				iso2: country.iso2,
				latitude: country.latitude,
				longitude: country.longitude,
				translations: country.translations,
			})
			.from(country)
			.where(eq(country.enabled, true))
			.orderBy(asc(country.name));

		const result = countries.map((c) => {
			const countryResult = {
				id: c.id,
				name: c.name,
				emoji: c.emoji || null,
				iso2: c.iso2,
				latitude: c.latitude ? Number(c.latitude) : null,
				longitude: c.longitude ? Number(c.longitude) : null,
				translations: c.translations ? (c.translations as Record<string, string> | null) : null,
			};

			if (c.translations) {
				const translations = c.translations as Record<string, string> | null;
				if (translations && typeof translations === "object") {
					const allTranslations: Record<string, string> = {};
					for (const locale of VALID_LOCALES) {
						if (translations[locale] && typeof translations[locale] === "string") {
							allTranslations[locale] = translations[locale];
						}
					}
					if (Object.keys(allTranslations).length > 0) {
						countryResult.translations = allTranslations;
					}
				}
			}

			return countryResult;
		});

		return response.json(result);
	},
	{
		schema: {
			tags: ["Countries"],
			summary: "Get all enabled countries",
			description: "Returns a list of all enabled countries with their translations",
			response: {
				200: z.array(countrySchema),
			},
		},
	},
);
