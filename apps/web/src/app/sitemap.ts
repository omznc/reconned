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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const [clubsResponse, eventsResponse, usersResponse] = await Promise.all([
		apiServer.GET("/api/public/sitemap/clubs"),
		apiServer.GET("/api/public/sitemap/events"),
		apiServer.GET("/api/public/sitemap/users"),
	]);

	const clubs = clubsResponse?.data?.clubs || [];
	const events = eventsResponse?.data?.events || [];
	const users = usersResponse?.data?.users || [];

	if (clubsResponse.error || eventsResponse.error || usersResponse.error) {
		logger.error("Error fetching sitemap data", {
			clubsResponse,
			eventsResponse,
			usersResponse,
		});
	}

	// Static routes with their properties
	const staticRoutes: MetadataRoute.Sitemap = [
		"",
		"/about",
		"/events",
		"/users",
		"/clubs",
		"/search",
		"/sponsors",
		"/login",
		"/register",
		"/changelog",
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
