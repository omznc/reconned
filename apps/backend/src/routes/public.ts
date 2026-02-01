import { and, eq, or, sql } from "drizzle-orm";
import * as z from "zod";
import { club, event, featureFlag, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { isFeatureEnabled } from "../lib/feature-flags";
import { logger } from "../lib/posthog";
import { Router } from "../lib/router";

const publicRouter = new Router();

publicRouter.get(
	"/public/clubs/map",
	async ({ context, response }) => {
		// Check ONLY_VERIFIED_CLUBS_VISIBLE feature flag
		const onlyVerifiedClubs = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");

		const whereConditions = [
			eq(club.isPrivate, false),
			sql`${club.latitude} IS NOT NULL`,
			sql`${club.longitude} IS NOT NULL`,
		];

		if (onlyVerifiedClubs) {
			whereConditions.push(eq(club.verified, true));
		}

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
			.where(and(...whereConditions));

		logger.emit({
			severityText: "info",
			body: "Retrieved clubs for map",
			attributes: {
				club_count: clubs.length,
				only_verified: onlyVerifiedClubs,
				request_id: context.requestId,
			},
		});

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

publicRouter.get(
	"/public/sitemap/clubs",
	async ({ response }) => {
		// Check ONLY_VERIFIED_CLUBS_VISIBLE feature flag
		const onlyVerifiedClubs = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");

		const whereConditions = [eq(club.isPrivate, false), or(eq(club.banned, false), sql`${club.banned} IS NULL`)];

		if (onlyVerifiedClubs) {
			whereConditions.push(eq(club.verified, true));
		}

		const clubs = await db
			.select({
				id: club.id,
				slug: club.slug,
				updatedAt: club.updatedAt,
			})
			.from(club)
			.where(and(...whereConditions));

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

publicRouter.get(
	"/public/feature-flags",
	async ({ context, response }) => {
		const flags = await db
			.select({
				name: featureFlag.name,
				enabled: featureFlag.enabled,
			})
			.from(featureFlag)
			.where(eq(featureFlag.enabled, true));

		logger.emit({
			severityText: "info",
			body: "Retrieved feature flags",
			attributes: {
				flag_count: flags.length,
				flags: flags.map((f) => f.name),
				request_id: context.requestId,
			},
		});

		return response.json({ featureFlags: flags });
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get enabled feature flags",
			description: "Get all enabled feature flags for frontend consumption",
			response: {
				200: z.object({
					featureFlags: z.array(
						z.object({
							name: z.string(),
							enabled: z.boolean(),
						}),
					),
				}),
			},
		},
	},
);

export { publicRouter };
