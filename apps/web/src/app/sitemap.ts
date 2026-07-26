import type { MetadataRoute } from "next";
import { Logger } from "next-axiom";
import { routing } from "@/i18n/routing";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { PRIVACY_POLICY_LAST_UPDATED, TERMS_OF_USE_LAST_UPDATED } from "@/lib/legal-dates";
import {
	constructCanonicalUrl,
	generateHreflangAlternatesForSluggableEntity,
	generatePageLanguages,
} from "@/lib/utils";

export const revalidate = 86400;

const defaultLocale = routing.defaultLocale;
const baseUrl = env.NEXT_PUBLIC_WEB_URL;

const logger = new Logger({ source: "sitemap" });

/**
 * `apiServer` turns connection-level failures (backend not running, DNS failure) into a
 * synthetic 503 `{ error }`, so the error branch below is the normal path when the backend is
 * unreachable. The catch stays as a belt-and-braces guard: this route is prerendered at build
 * time, and a sitemap must never be able to break a deploy — on any failure we log and fall
 * back to the static routes below.
 */
async function fetchSitemapSection<T>(label: string, request: Promise<{ data?: T; error?: unknown }>) {
	try {
		const response = await request;
		if (response.error) {
			logger.error("Error fetching sitemap data", { section: label, error: response.error });
		}
		return response.data;
	} catch (error) {
		logger.error("Could not reach the API for sitemap data", { section: label, error });
		return undefined;
	}
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const [clubsData, eventsData, usersData, citiesData] = await Promise.all([
		fetchSitemapSection("clubs", apiServer.GET("/api/public/sitemap/clubs", { next: { revalidate: 86400 } })),
		fetchSitemapSection("events", apiServer.GET("/api/public/sitemap/events", { next: { revalidate: 86400 } })),
		fetchSitemapSection("users", apiServer.GET("/api/public/sitemap/users", { next: { revalidate: 86400 } })),
		fetchSitemapSection("cities", apiServer.GET("/api/public/cities", { next: { revalidate: 86400 } })),
	]);

	const clubs = clubsData?.clubs || [];
	const events = eventsData?.events || [];
	const users = usersData?.users || [];
	const cities = citiesData?.cities || [];

	// `lastmod` must reflect a real content change. Stamping `new Date()` on every
	// route (as this did) makes the whole file say "everything changed just now" on
	// each regeneration — Google detects that pattern and stops trusting the field
	// sitewide, including the accurate per-entity values below. Listing pages
	// therefore inherit the newest `updatedAt` of what they list, legal pages use
	// their own revision date, and pages with no tracked change date simply omit
	// the field, which is valid and better than a fabricated one.
	const newestUpdate = (items: Array<{ updatedAt: string }>): Date | undefined => {
		let newest: number | undefined;
		for (const item of items) {
			const time = new Date(item.updatedAt).getTime();
			if (!Number.isNaN(time) && (newest === undefined || time > newest)) {
				newest = time;
			}
		}
		return newest === undefined ? undefined : new Date(newest);
	};

	const clubsUpdated = newestUpdate(clubs);
	const eventsUpdated = newestUpdate(events);
	const usersUpdated = newestUpdate(users);
	const anyUpdated = newestUpdate([...clubs, ...events, ...users]);

	const staticRoutes: MetadataRoute.Sitemap = (
		[
			{ route: "", lastModified: anyUpdated, changeFrequency: "daily", priority: 1 },
			{ route: "/events", lastModified: eventsUpdated, changeFrequency: "daily", priority: 0.8 },
			{ route: "/users", lastModified: usersUpdated, changeFrequency: "weekly", priority: 0.8 },
			{ route: "/clubs", lastModified: clubsUpdated, changeFrequency: "daily", priority: 0.8 },
			{ route: "/clubs/city", lastModified: clubsUpdated, changeFrequency: "weekly", priority: 0.7 },
			{ route: "/search", lastModified: anyUpdated, changeFrequency: "daily", priority: 0.8 },
			{ route: "/map", lastModified: clubsUpdated, changeFrequency: "daily", priority: 0.8 },
			{ route: "/sponsors", changeFrequency: "monthly", priority: 0.8 },
			{ route: "/developers", changeFrequency: "monthly", priority: 0.8 },
			{ route: "/support-us", changeFrequency: "monthly", priority: 0.8 },
			{
				route: "/privacy-policy",
				lastModified: PRIVACY_POLICY_LAST_UPDATED,
				changeFrequency: "yearly",
				priority: 0.8,
			},
			{
				route: "/terms-of-use",
				lastModified: TERMS_OF_USE_LAST_UPDATED,
				changeFrequency: "yearly",
				priority: 0.8,
			},
		] satisfies Array<{
			route: string;
			lastModified?: Date;
			changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
			priority: number;
		}>
	).map(({ route, lastModified, changeFrequency, priority }) => ({
		url: constructCanonicalUrl(baseUrl || "", route, defaultLocale),
		...(lastModified && { lastModified }),
		changeFrequency,
		priority,
		alternates: {
			languages: generatePageLanguages(baseUrl || "", route, defaultLocale),
		},
	}));

	// Generate dynamic routes with language alternates
	const clubRoutes = clubs.map((club) => {
		const pathPrefix = "/clubs";
		const slugOrId = club.slug || club.id;
		return {
			url: constructCanonicalUrl(baseUrl || "", `${pathPrefix}/${slugOrId}`, defaultLocale),
			lastModified: new Date(club.updatedAt),
			changeFrequency: "daily" as const,
			priority: club.slug ? 0.8 : 0.7,
			alternates: {
				languages: generateHreflangAlternatesForSluggableEntity(
					baseUrl || "",
					pathPrefix,
					club.id,
					defaultLocale,
					club.slug || undefined,
				),
			},
		};
	});

	// City pages have no `updatedAt` of their own — they are a view over the clubs
	// they list, so they change whenever any club does. `clubsUpdated` is the
	// closest honest answer available without a second round trip per city.
	const cityRoutes = cities.map((city) => {
		const route = `/clubs/city/${city.citySlug}`;
		return {
			url: constructCanonicalUrl(baseUrl || "", route, defaultLocale),
			...(clubsUpdated && { lastModified: clubsUpdated }),
			changeFrequency: "weekly" as const,
			priority: 0.7,
			alternates: {
				languages: generatePageLanguages(baseUrl || "", route, defaultLocale),
			},
		};
	});

	const eventRoutes = events.map((event) => {
		const pathPrefix = "/events";
		const slugOrId = event.slug || event.id;
		return {
			url: constructCanonicalUrl(baseUrl || "", `${pathPrefix}/${slugOrId}`, defaultLocale),
			lastModified: new Date(event.updatedAt),
			changeFrequency: "daily" as const,
			priority: event.slug ? 0.7 : 0.6,
			alternates: {
				languages: generateHreflangAlternatesForSluggableEntity(
					baseUrl || "",
					pathPrefix,
					event.id,
					defaultLocale,
					event.slug || undefined,
				),
			},
		};
	});

	const userRoutes = users.map((user) => {
		const pathPrefix = "/users";
		const slugOrId = user.slug || user.id;
		return {
			url: constructCanonicalUrl(baseUrl || "", `${pathPrefix}/${slugOrId}`, defaultLocale),
			lastModified: new Date(user.updatedAt),
			changeFrequency: "weekly" as const,
			priority: user.slug ? 0.6 : 0.5,
			alternates: {
				languages: generateHreflangAlternatesForSluggableEntity(
					baseUrl || "",
					pathPrefix,
					user.id,
					defaultLocale,
					user.slug || undefined,
				),
			},
		};
	});

	return [...staticRoutes, ...cityRoutes, ...clubRoutes, ...eventRoutes, ...userRoutes];
}
