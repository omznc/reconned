import type { MetadataRoute } from "next";
import { Logger } from "next-axiom";
import { routing } from "@/i18n/routing";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
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
 * `apiServer` only returns `{ error }` for HTTP-level failures — a connection error (backend not
 * running, DNS failure) rejects instead. This route is prerendered at build time, so an
 * unreachable backend would otherwise fail the whole build. A sitemap must never be able to
 * break a deploy: on failure we log and fall back to the static routes below.
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
	const [clubsData, eventsData, usersData] = await Promise.all([
		fetchSitemapSection("clubs", apiServer.GET("/api/public/sitemap/clubs", { next: { revalidate: 86400 } })),
		fetchSitemapSection("events", apiServer.GET("/api/public/sitemap/events", { next: { revalidate: 86400 } })),
		fetchSitemapSection("users", apiServer.GET("/api/public/sitemap/users", { next: { revalidate: 86400 } })),
	]);

	const clubs = clubsData?.clubs || [];
	const events = eventsData?.events || [];
	const users = usersData?.users || [];

	// Static routes with their properties
	const staticRoutes: MetadataRoute.Sitemap = [
		"",
		"/events",
		"/users",
		"/clubs",
		"/search",
		"/sponsors",
		"/developers",
		"/map",
		"/privacy-policy",
		"/terms-of-use",
		"/support-us",
	].map((route) => ({
		url: constructCanonicalUrl(baseUrl || "", route, defaultLocale),
		lastModified: new Date(),
		changeFrequency: "daily",
		priority: route === "" ? 1 : 0.8,
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

	return [...staticRoutes, ...clubRoutes, ...eventRoutes, ...userRoutes];
}
