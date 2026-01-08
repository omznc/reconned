import { and, eq, or, sql } from "drizzle-orm";
import * as z from "zod";
import { club, event, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { Router } from "../lib/router";

const publicRouter = new Router();

// NOTE: Public club endpoints have been removed in favor of using /api/clubs with in-route sanitization.

publicRouter.get(
	"/public/clubs/map",
	async ({ response }) => {
		const clubs = await db
			.select({
				id: club.id,
				name: club.name,
				slug: club.slug,
				logo: club.logo,
				latitude: club.latitude,
				longitude: club.longitude,
				location: club.location,
			})
			.from(club)
			.where(
				and(eq(club.isPrivate, false), sql`${club.latitude} IS NOT NULL`, sql`${club.longitude} IS NOT NULL`),
			);

		return response.json({ clubs });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get clubs for map",
			description: "Get public clubs with coordinates for map display",
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							slug: z.string().nullable(),
							logo: z.string().nullable(),
							latitude: z.number().nullable(),
							longitude: z.number().nullable(),
							location: z.string().nullable(),
						}),
					),
				}),
			},
		},
	},
);

// NOTE: Public event endpoint removed; /api/events/:id now enforces privacy and is safe for public use.

publicRouter.get(
	"/public/sitemap/clubs",
	async ({ response }) => {
		const clubs = await db
			.select({
				id: club.id,
				slug: club.slug,
				updatedAt: club.updatedAt,
			})
			.from(club)
			.where(and(eq(club.isPrivate, false), or(eq(club.banned, false), sql`${club.banned} IS NULL`)));

		return response.json({ clubs });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get clubs for sitemap",
			description: "Get all public clubs for sitemap generation",
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							updatedAt: z.string(),
						}),
					),
				}),
			},
		},
	},
);

publicRouter.get(
	"/public/sitemap/events",
	async ({ response }) => {
		const events = await db
			.select({
				id: event.id,
				slug: event.slug,
				updatedAt: event.updatedAt,
			})
			.from(event)
			.where(
				and(
					eq(event.isPrivate, false),
					sql`
						EXISTS (
							SELECT 1
							FROM "Club" c
							WHERE c."id" = ${event.clubId}
							AND c."isPrivate" = false
						)
					`,
				),
			);

		return response.json({ events });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get events for sitemap",
			description: "Get all public events for sitemap generation",
			response: {
				200: z.object({
					events: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							updatedAt: z.string(),
						}),
					),
				}),
			},
		},
	},
);

publicRouter.get(
	"/public/sitemap/users",
	async ({ response }) => {
		const users = await db
			.select({
				id: user.id,
				slug: user.slug,
				updatedAt: user.updatedAt,
			})
			.from(user)
			.where(and(eq(user.isPrivate, false), or(eq(user.banned, false), sql`${user.banned} IS NULL`)));

		return response.json({ users });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get users for sitemap",
			description: "Get all public users for sitemap generation",
			response: {
				200: z.object({
					users: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							updatedAt: z.string(),
						}),
					),
				}),
			},
		},
	},
);

export { publicRouter };
