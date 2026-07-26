import { Router } from "@reconned/router";
import { and, count, eq, or, sql } from "drizzle-orm";
import * as z from "zod";
import { club, event, featureFlag, user } from "../drizzle/schema";
import { db } from "../lib/db";
import { isFeatureEnabled } from "../lib/feature-flags";
import { logger } from "../lib/posthog";
import { redis } from "../lib/redis";

const STATS_CACHE_KEY = "public:stats";
const STATS_CACHE_TTL = 86400;

const publicRouter = new Router();

function cachedJson<T>(data: T, cacheControl: string): Response {
	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": cacheControl,
		},
	});
}

publicRouter.get(
	"/public/clubs/map",
	async ({ context }) => {
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

		return cachedJson({ clubs }, "public, max-age=300, stale-while-revalidate=1800");
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
	async () => {
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

		return cachedJson({ clubs }, "public, max-age=3600, stale-while-revalidate=86400");
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
	async () => {
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

		return cachedJson({ events }, "public, max-age=3600, stale-while-revalidate=86400");
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
	async () => {
		const users = await db
			.select({
				id: user.id,
				slug: user.slug,
				updatedAt: user.updatedAt,
			})
			.from(user)
			.where(and(eq(user.isPrivate, false), or(eq(user.banned, false), sql`${user.banned} IS NULL`)));

		return cachedJson({ users }, "public, max-age=3600, stale-while-revalidate=86400");
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

/** Descriptions are prose of unbounded length; llms-full.txt wants a gist, not the essay. */
const LLMS_DESCRIPTION_LIMIT = 300;

publicRouter.get(
	"/public/llms",
	async () => {
		// Visibility filters are duplicated from the `/public/sitemap/*` handlers above
		// rather than shared, deliberately: this endpoint is served unauthenticated and
		// its output is cached publicly, so its filters must be readable in isolation.
		// Anything private, banned, or gated behind ONLY_VERIFIED_CLUBS_VISIBLE must
		// never reach it.
		const onlyVerifiedClubs = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");

		const clubWhere = [eq(club.isPrivate, false), or(eq(club.banned, false), sql`${club.banned} IS NULL`)];
		if (onlyVerifiedClubs) {
			clubWhere.push(eq(club.verified, true));
		}

		const [clubs, events] = await Promise.all([
			db
				.select({
					id: club.id,
					slug: club.slug,
					name: club.name,
					description: club.description,
					location: club.location,
					verified: club.verified,
				})
				.from(club)
				.where(and(...clubWhere))
				.orderBy(club.name),
			db
				.select({
					id: event.id,
					slug: event.slug,
					name: event.name,
					description: event.description,
					location: event.location,
					dateStart: event.dateStart,
					dateEnd: event.dateEnd,
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
				)
				.orderBy(event.dateStart),
		]);

		const truncate = (value: string | null) =>
			value && value.length > LLMS_DESCRIPTION_LIMIT
				? `${value.slice(0, LLMS_DESCRIPTION_LIMIT).trimEnd()}…`
				: value;

		return cachedJson(
			{
				clubs: clubs.map((c) => ({ ...c, description: truncate(c.description) })),
				events: events.map((e) => ({ ...e, description: truncate(e.description) })),
			},
			"public, max-age=3600, stale-while-revalidate=86400",
		);
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get clubs and events for llms-full.txt",
			description: "Public clubs and events with names and summaries, for LLM-facing site indexes",
			response: {
				200: z.object({
					clubs: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							name: z.string(),
							description: z.string().nullable(),
							location: z.string().nullable(),
							verified: z.boolean(),
						}),
					),
					events: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							name: z.string(),
							description: z.string().nullable(),
							location: z.string().nullable(),
							dateStart: z.string(),
							dateEnd: z.string().nullable(),
						}),
					),
				}),
			},
		},
	},
);

/**
 * The city landing pages are only worth generating where there is something to
 * land on. A single club reads as an empty page to a visitor and as thin content
 * to a crawler, so a city has to clear this bar before it gets a page of its own.
 */
const MIN_CLUBS_PER_CITY = 2;

/**
 * Visibility filters for the city endpoints. Duplicated from `/public/llms`
 * above for the same reason: these are served unauthenticated and cached
 * publicly, so what they may expose has to be readable without following a
 * helper somewhere else.
 */
async function publicClubConditions() {
	const conditions = [eq(club.isPrivate, false), or(eq(club.banned, false), sql`${club.banned} IS NULL`)];
	if (await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE")) {
		conditions.push(eq(club.verified, true));
	}
	return conditions;
}

publicRouter.get(
	"/public/cities",
	async () => {
		const cities = await db
			.select({
				city: club.city,
				citySlug: club.citySlug,
				clubCount: count(club.id),
			})
			.from(club)
			.where(and(sql`${club.citySlug} IS NOT NULL`, ...(await publicClubConditions())))
			.groupBy(club.city, club.citySlug)
			.having(sql`count(${club.id}) >= ${MIN_CLUBS_PER_CITY}`)
			.orderBy(club.city);

		return cachedJson(
			{
				// `city`/`citySlug` are non-null by the WHERE clause, but Drizzle types them
				// from the nullable column; the filter re-establishes that for the schema.
				cities: cities.flatMap((row) =>
					row.city && row.citySlug
						? [{ city: row.city, citySlug: row.citySlug, clubCount: row.clubCount }]
						: [],
				),
			},
			"public, max-age=3600, stale-while-revalidate=86400",
		);
	},
	{
		schema: {
			tags: ["Public"],
			summary: "List cities with clubs",
			description: `Cities that have at least ${MIN_CLUBS_PER_CITY} public clubs, with their club counts`,
			response: {
				200: z.object({
					cities: z.array(
						z.object({
							city: z.string(),
							citySlug: z.string(),
							clubCount: z.number(),
						}),
					),
				}),
			},
		},
	},
);

publicRouter.get(
	"/public/cities/:citySlug",
	async ({ params }) => {
		// The route cannot match without the segment; the narrowing is for the types,
		// which carry every path param as optional.
		const citySlug = params.citySlug ?? "";
		const clubConditions = await publicClubConditions();
		const clubs = await db
			.select({
				id: club.id,
				slug: club.slug,
				name: club.name,
				description: club.description,
				location: club.location,
				city: club.city,
				logo: club.logo,
				latitude: club.latitude,
				longitude: club.longitude,
				verified: club.verified,
				updatedAt: club.updatedAt,
			})
			.from(club)
			.where(and(eq(club.citySlug, citySlug), ...clubConditions))
			.orderBy(club.name);

		// Events inherit their city from the club running them: an event has no city
		// of its own, and the club's is the one a visitor searched for.
		const events = await db
			.select({
				id: event.id,
				slug: event.slug,
				name: event.name,
				description: event.description,
				location: event.location,
				dateStart: event.dateStart,
				dateEnd: event.dateEnd,
				clubName: club.name,
			})
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.where(and(eq(event.isPrivate, false), eq(club.citySlug, citySlug), ...clubConditions))
			.orderBy(event.dateStart);

		return cachedJson(
			{
				city: clubs[0]?.city ?? null,
				citySlug,
				clubs: clubs.map(({ city: _city, ...rest }) => rest),
				events,
			},
			"public, max-age=3600, stale-while-revalidate=86400",
		);
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Get a city's clubs and events",
			description: "Public clubs based in a city, plus the events those clubs are running",
			params: z.object({
				citySlug: z.string(),
			}),
			response: {
				200: z.object({
					city: z.string().nullable(),
					citySlug: z.string(),
					clubs: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							name: z.string(),
							description: z.string().nullable(),
							location: z.string().nullable(),
							logo: z.string().nullable(),
							latitude: z.number().nullable(),
							longitude: z.number().nullable(),
							verified: z.boolean(),
							updatedAt: z.string(),
						}),
					),
					events: z.array(
						z.object({
							id: z.string(),
							slug: z.string().nullable(),
							name: z.string(),
							description: z.string().nullable(),
							location: z.string().nullable(),
							dateStart: z.string(),
							dateEnd: z.string().nullable(),
							clubName: z.string(),
						}),
					),
				}),
			},
		},
	},
);

publicRouter.get(
	"/public/stats",
	async () => {
		try {
			const cached = await redis.get(STATS_CACHE_KEY);
			if (cached) {
				return cachedJson(JSON.parse(cached), "public, max-age=3600, stale-while-revalidate=86400");
			}
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Error reading stats from cache",
				attributes: { error: error instanceof Error ? error.message : String(error) },
			});
		}

		const [clubCountRow] = await db.select({ value: count() }).from(club);
		const [eventCountRow] = await db.select({ value: count() }).from(event);
		const [userCountRow] = await db.select({ value: count() }).from(user);

		const stats = {
			stats: {
				clubs: Number(clubCountRow?.value ?? 0),
				events: Number(eventCountRow?.value ?? 0),
				players: Number(userCountRow?.value ?? 0),
			},
		};

		try {
			await redis.setex(STATS_CACHE_KEY, STATS_CACHE_TTL, JSON.stringify(stats));
		} catch (error) {
			logger.emit({
				severityText: "error",
				body: "Error caching stats",
				attributes: { error: error instanceof Error ? error.message : String(error) },
			});
		}

		return cachedJson(stats, "public, max-age=3600, stale-while-revalidate=86400");
	},
	{
		schema: {
			tags: ["Public"],
			summary: "Public platform counts",
			description: "Aggregated counts of all clubs, events, and player profiles for marketing display",
			response: {
				200: z.object({
					stats: z.object({
						clubs: z.number(),
						events: z.number(),
						players: z.number(),
					}),
				}),
			},
		},
	},
);

publicRouter.get(
	"/public/feature-flags",
	async ({ context }) => {
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

		return cachedJson({ featureFlags: flags }, "public, max-age=300, stale-while-revalidate=1800");
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
