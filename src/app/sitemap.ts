import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export const revalidate = 86_400; // 24 hours

const locales = routing.locales;
const defaultLocale = routing.defaultLocale;
const baseUrl = env.NEXT_PUBLIC_BETTER_AUTH_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// Get all data concurrently
	const [clubs, events, users] = await Promise.all([
		// Get public clubs
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

		// Get public events
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

		// Get public user profiles
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
	]);

	// Static routes with their properties
	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: getCanonicalUrl(""),
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 1,
			alternates: generateAlternates(""),
		},
		{
			url: getCanonicalUrl("/about"),
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.8,
			alternates: generateAlternates("/about"),
		},
		{
			url: getCanonicalUrl("/events"),
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
			alternates: generateAlternates("/events"),
		},
		{
			url: getCanonicalUrl("/users"),
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
			alternates: generateAlternates("/users"),
		},
		{
			url: getCanonicalUrl("/clubs"),
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
			alternates: generateAlternates("/clubs"),
		},
		{
			url: getCanonicalUrl("/search"),
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
			alternates: generateAlternates("/search"),
		},
		{
			url: getCanonicalUrl("/sponsors"),
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
			alternates: generateAlternates("/sponsors"),
		},
		{
			url: getCanonicalUrl("/login"),
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
			alternates: generateAlternates("/login"),
		},
		{
			url: getCanonicalUrl("/register"),
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
			alternates: generateAlternates("/register"),
		},
	];

	// Generate dynamic routes with language alternates
	const clubRoutes = clubs.map((club) => {
		const path = `/clubs/${club.slug ?? club.id}`;
		return {
			url: getCanonicalUrl(path),
			lastModified: club.updatedAt,
			changeFrequency: "daily" as const,
			priority: club.slug ? 0.8 : 0.7,
			alternates: generateAlternates(path),
		};
	});

	const eventRoutes = events.map((event) => {
		const path = `/events/${event.slug ?? event.id}`;
		return {
			url: getCanonicalUrl(path),
			lastModified: event.updatedAt,
			changeFrequency: "daily" as const,
			priority: event.slug ? 0.7 : 0.6,
			alternates: generateAlternates(path),
		};
	});

	const userRoutes = users.map((user) => {
		const path = `/users/${user.slug ?? user.id}`;
		return {
			url: getCanonicalUrl(path),
			lastModified: user.updatedAt,
			changeFrequency: "weekly" as const,
			priority: user.slug ? 0.6 : 0.5,
			alternates: generateAlternates(path),
		};
	});

	// Combine all routes
	return [...staticRoutes, ...clubRoutes, ...eventRoutes, ...userRoutes];
}

// Helper function to generate language alternates for each route
function generateAlternates(path: string) {
	const languages: Record<string, string> = {};

	for (const locale of locales) {
		// Only include non-default locales in alternates
		if (locale !== defaultLocale) {
			languages[locale] = `${baseUrl}/${locale}${path}`;
		}
	}

	return { languages };
}

// Helper function to get the canonical URL (with default locale)
function getCanonicalUrl(path: string) {
	return `${baseUrl}/${defaultLocale}${path}`;
}
