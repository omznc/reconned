import { routing } from "@/i18n/routing";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { PRIVACY_POLICY_LAST_UPDATED, TERMS_OF_USE_LAST_UPDATED } from "@/lib/legal-dates";
import { logger } from "@/lib/logger";
import {
	constructCanonicalUrl,
	generateHreflangAlternatesForSluggableEntity,
	generatePageLanguages,
} from "@/lib/utils";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export type SitemapEntry = {
	url: string;
	lastModified?: Date;
	changeFrequency: ChangeFrequency;
	priority: number;
	alternates: { languages: Record<string, string> };
};

type Sluggable = { id: string; slug: string | null; updatedAt: string };

const defaultLocale = routing.defaultLocale;

/**
 * `apiServer` turns connection-level failures (backend not running, DNS failure) into a
 * synthetic 503 `{ error }`, so the error branch below is the normal path when the backend is
 * unreachable. The catch stays as a guard: a sitemap must never fail, so on any failure we log
 * and fall back to the static routes.
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

function newestUpdate(items: Array<{ updatedAt: string }>): Date | undefined {
	let newest: number | undefined;
	for (const item of items) {
		const time = new Date(item.updatedAt).getTime();
		if (!Number.isNaN(time) && (newest === undefined || time > newest)) {
			newest = time;
		}
	}
	return newest === undefined ? undefined : new Date(newest);
}

function sluggableEntries(
	items: Sluggable[],
	pathPrefix: string,
	changeFrequency: ChangeFrequency,
	slugPriority: number,
	idPriority: number,
): SitemapEntry[] {
	const baseUrl = env.NEXT_PUBLIC_WEB_URL;
	return items.map((item) => ({
		url: constructCanonicalUrl(baseUrl || "", `${pathPrefix}/${item.slug || item.id}`, defaultLocale),
		lastModified: new Date(item.updatedAt),
		changeFrequency,
		priority: item.slug ? slugPriority : idPriority,
		alternates: {
			languages: generateHreflangAlternatesForSluggableEntity(
				baseUrl || "",
				pathPrefix,
				item.id,
				defaultLocale,
				item.slug || undefined,
			),
		},
	}));
}

function pageEntry(
	route: string,
	changeFrequency: ChangeFrequency,
	priority: number,
	lastModified?: Date,
): SitemapEntry {
	const baseUrl = env.NEXT_PUBLIC_WEB_URL;
	return {
		url: constructCanonicalUrl(baseUrl || "", route, defaultLocale),
		...(lastModified && { lastModified }),
		changeFrequency,
		priority,
		alternates: { languages: generatePageLanguages(baseUrl || "", route, defaultLocale) },
	};
}

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
	const [clubsData, eventsData, usersData, citiesData] = await Promise.all([
		fetchSitemapSection("clubs", apiServer.GET("/api/public/sitemap/clubs")),
		fetchSitemapSection("events", apiServer.GET("/api/public/sitemap/events")),
		fetchSitemapSection("users", apiServer.GET("/api/public/sitemap/users")),
		fetchSitemapSection("cities", apiServer.GET("/api/public/cities")),
	]);

	const clubs = clubsData?.clubs || [];
	const events = eventsData?.events || [];
	const users = usersData?.users || [];
	const cities = citiesData?.cities || [];

	// `lastmod` must reflect a real content change. Listing pages inherit the newest `updatedAt`
	// of what they list, legal pages use their own revision date, and pages with no tracked
	// change date omit the field, which is valid and better than a fabricated one.
	const clubsUpdated = newestUpdate(clubs);
	const eventsUpdated = newestUpdate(events);
	const usersUpdated = newestUpdate(users);
	const anyUpdated = newestUpdate([...clubs, ...events, ...users]);

	const staticRoutes = [
		pageEntry("", "daily", 1, anyUpdated),
		pageEntry("/events", "daily", 0.8, eventsUpdated),
		pageEntry("/users", "weekly", 0.8, usersUpdated),
		pageEntry("/clubs", "daily", 0.8, clubsUpdated),
		pageEntry("/clubs/city", "weekly", 0.7, clubsUpdated),
		pageEntry("/search", "daily", 0.8, anyUpdated),
		pageEntry("/map", "daily", 0.8, clubsUpdated),
		pageEntry("/sponsors", "monthly", 0.8),
		pageEntry("/developers", "monthly", 0.8),
		pageEntry("/support-us", "monthly", 0.8),
		pageEntry("/privacy-policy", "yearly", 0.8, PRIVACY_POLICY_LAST_UPDATED),
		pageEntry("/terms-of-use", "yearly", 0.8, TERMS_OF_USE_LAST_UPDATED),
	];

	// City pages have no `updatedAt` of their own: they change whenever any club does.
	const cityRoutes = cities.map((city) => pageEntry(`/clubs/city/${city.citySlug}`, "weekly", 0.7, clubsUpdated));

	return [
		...staticRoutes,
		...cityRoutes,
		...sluggableEntries(clubs, "/clubs", "daily", 0.8, 0.7),
		...sluggableEntries(events, "/events", "daily", 0.7, 0.6),
		...sluggableEntries(users, "/users", "weekly", 0.6, 0.5),
	];
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function entryToXml(entry: SitemapEntry): string {
	const lines = ["<url>", `<loc>${escapeXml(entry.url)}</loc>`];
	for (const [language, href] of Object.entries(entry.alternates.languages)) {
		lines.push(`<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(href)}" />`);
	}
	if (entry.lastModified) {
		lines.push(`<lastmod>${entry.lastModified.toISOString()}</lastmod>`);
	}
	lines.push(`<changefreq>${entry.changeFrequency}</changefreq>`, `<priority>${entry.priority}</priority>`, "</url>");
	return lines.join("\n");
}

export function renderSitemapXml(entries: SitemapEntry[]): string {
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...entries.map(entryToXml),
		"</urlset>",
		"",
	].join("\n");
}
