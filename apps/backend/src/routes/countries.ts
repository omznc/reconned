import { Router } from "@reconned/router";
import { asc, eq } from "drizzle-orm";
import * as z from "zod";
import { country } from "../drizzle/schema";
import { db } from "../lib/db";
import { logger } from "../lib/posthog";
import { redis } from "../lib/redis";

const VALID_LOCALES = ["en", "bs", "sr"];

const COUNTRIES_CACHE_KEY = "countries:enabled";
const COUNTRIES_CACHE_TTL = 3600;

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

function cachedJson<T>(data: T, cacheControl: string): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": cacheControl,
		},
	});
}

countriesRouter.get(
	"/countries",
	async ({ context }) => {
		try {
			const cached = await redis.get(COUNTRIES_CACHE_KEY);
			if (cached) {
				return cachedJson(JSON.parse(cached), "public, max-age=3600, stale-while-revalidate=86400");
			}
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Error reading countries from cache",
				attributes: { error: error instanceof Error ? error.message : String(error) },
			});
		}

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

		logger.emit({
			severityText: "info",
			body: "Retrieved enabled countries",
			attributes: {
				country_count: result.length,
				request_id: context.requestId,
			},
		});

		try {
			await redis.setex(COUNTRIES_CACHE_KEY, COUNTRIES_CACHE_TTL, JSON.stringify(result));
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Error caching countries",
				attributes: { error: error instanceof Error ? error.message : String(error) },
			});
		}

		return cachedJson(result, "public, max-age=3600, stale-while-revalidate=86400");
	},
	{
		schema: {
			tags: ["Countries"],
			summary: "Get all enabled countries",
			description:
				"Returns a list of all enabled countries with their translations. Use this to look up a country's ID before passing it as countryId to other tools (e.g. creating or updating a club).",
			response: {
				200: z.array(countrySchema),
			},
			mcpTool: true,
		},
	},
);
