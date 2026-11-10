import "server-only";

import { getExtracted } from "next-intl/server";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createBreadcrumbList, createItemListWithClubs, createWebPageSchema } from "@/lib/json-ld";
import type { SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

/**
 * A city page exists only as long as the city still has clubs. Returning `null`
 * here (rather than an empty page) is what makes an emptied-out city 404 instead
 * of lingering in the index as a blank result.
 */
export async function getCity(citySlug: string) {
	const { data, error } = await apiServer.GET("/api/public/cities/{citySlug}", {
		params: { path: { citySlug } },
	});

	if (error || !data || data.clubs.length === 0 || !data.city) {
		return null;
	}

	return { ...data, city: data.city };
}

type City = NonNullable<Awaited<ReturnType<typeof getCity>>>;

export async function buildCitySeo(data: City, citySlug: string, locale: string): Promise<SeoInput> {
	const t = await getExtracted({ locale });
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
	const cityName = data.city;
	const path = `/clubs/city/${citySlug}`;
	const pageUrl = constructCanonicalUrl(baseUrl, path, locale);

	// The clubs are already the complete set for this city, so the list is a single
	// page of itself — there is no pagination to describe.
	const itemListSchema = createItemListWithClubs({
		clubs: data.clubs.map((club) => ({
			id: club.id,
			slug: club.slug,
			name: club.name,
			description: club.description,
			logo: club.logo,
			location: club.location,
			latitude: club.latitude,
			longitude: club.longitude,
			contactEmail: null,
			contactPhone: null,
			dateFounded: null,
			verified: club.verified,
		})),
		page: 1,
		itemsPerPage: data.clubs.length,
		total: data.clubs.length,
		locale,
		name: t("Airsoft clubs in {city}", { city: cityName }),
		description: t("Every airsoft club based in {city}, with the events they are running.", { city: cityName }),
	});

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: constructCanonicalUrl(baseUrl, "/", locale) },
		{ name: t("Clubs"), url: constructCanonicalUrl(baseUrl, "/clubs", locale) },
		{ name: cityName, url: pageUrl },
	]);

	// The freshest club in the city stands in for the page's own modification date:
	// the page is nothing but its clubs, so it is as current as they are.
	const lastModified = data.clubs.reduce<string | null>(
		(newest, club) => (newest === null || club.updatedAt > newest ? club.updatedAt : newest),
		null,
	);

	const webPageSchema = createWebPageSchema({
		pageUrl,
		name: t("Airsoft clubs in {city}", { city: cityName }),
		dateModified: lastModified,
	});

	return {
		title: t("Airsoft clubs in {city} - RECONNED", { city: cityName }),
		description: t(
			"{count, plural, one {# airsoft club} other {# airsoft clubs}} in {city}. See who plays nearby, which events they run, and how to join.",
			{ city: cityName, count: data.clubs.length },
		),
		canonical: pageUrl,
		languages: generatePageLanguages(baseUrl, path, locale),
		schemas: [webPageSchema, breadcrumbSchema, itemListSchema].map((schema) => JSON.stringify(schema)),
	};
}
