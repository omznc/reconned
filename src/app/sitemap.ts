import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getCached } from "@/lib/cache";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
	constructCanonicalUrl,
	generateHreflangAlternatesForSluggableEntity,
	generatePageLanguages,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

const defaultLocale = routing.defaultLocale;
const baseUrl = env.NEXT_PUBLIC_BETTER_AUTH_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// Get all data concurrently with caching
	const [clubs, events, users] = await Promise.all([
		// Get public clubs (cached for 30 minutes)
		getCached(
			"sitemap:clubs",
			() =>
				prisma.club.findMany({
					where: {
						isPrivate: false,
						OR: [{ banned: false }, { banned: null }],
					},
					select: {
						id: true,
						slug: true,
						updatedAt: true,
					},
				}),
			{ ttl: 1800 }, // 30 minutes
		),

		// Get public events (cached for 30 minutes)
		getCached(
			"sitemap:events",
			() =>
				prisma.event.findMany({
					where: {
						isPrivate: false,
					},
					select: {
						id: true,
						slug: true,
						updatedAt: true,
					},
				}),
			{ ttl: 1800 }, // 30 minutes
		),

		// Get public user profiles (cached for 30 minutes)
		getCached(
			"sitemap:users",
			() =>
				prisma.user.findMany({
					where: {
						isPrivate: false,
						OR: [{ banned: false }, { banned: null }],
					},
					select: {
						id: true,
						slug: true,
						updatedAt: true,
					},
				}),
			{ ttl: 1800 }, // 30 minutes
		),
	]);

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
			lastModified: club.updatedAt,
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
			lastModified: event.updatedAt,
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
			lastModified: user.updatedAt,
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

	// Combine all routes
	return [...staticRoutes, ...clubRoutes, ...eventRoutes, ...userRoutes];
}
