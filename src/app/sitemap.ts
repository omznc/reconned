import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { MetadataRoute } from "next";

export const revalidate = 86_400; // 24 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = env.NEXT_PUBLIC_BETTER_AUTH_URL;

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
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 1,
		},
		{
			url: `${baseUrl}/about`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/events`,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/search`,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.9,
		},
		{
			url: `${baseUrl}/sponsors`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/login`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/register`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
	];

	// Generate dynamic routes (prioritizing slug URLs)
	const clubRoutes = clubs.map((club) => ({
		url: `${baseUrl}/clubs/${club.slug ?? club.id}`,
		lastModified: club.updatedAt,
		changeFrequency: "daily" as const,
		priority: club.slug ? 0.8 : 0.7, // Slightly lower priority for ID-based URLs
	}));

	const eventRoutes = events.map((event) => ({
		url: `${baseUrl}/events/${event.slug ?? event.id}`,
		lastModified: event.updatedAt,
		changeFrequency: "daily" as const,
		priority: event.slug ? 0.7 : 0.6,
	}));

	const userRoutes = users.map((user) => ({
		url: `${baseUrl}/users/${user.slug ?? user.id}`,
		lastModified: user.updatedAt,
		changeFrequency: "weekly" as const,
		priority: user.slug ? 0.6 : 0.5,
	}));

	// Combine all routes
	return [...staticRoutes, ...clubRoutes, ...eventRoutes, ...userRoutes];
}
