import { and, count, desc, eq, exists, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import * as z from "zod";
import { club, clubMembership, event, user } from "../drizzle/schema";
import { db } from "./db";
import { escapeLike } from "./like";
import {
	loadAttendeeCounts,
	loadClubRatings,
	loadNextGames,
	loadUserClubs,
	nextGameSchema,
	placesLeftOf,
	ratingSchema,
	userClubSchema,
} from "./people-stats";
import { clubListedCondition, publicClubCondition, userNotBanned } from "./public-club";
import { baseEventSchema, logoTileOf, logoTileResponseSchema } from "./schemas";

/** Enough for the two clamped lines a result card shows. */
const CLUB_DESCRIPTION_CHARS = 240;

export const clubSearchDataSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string().nullable(),
	logo: z.string().nullable(),
	logoTile: logoTileResponseSchema,
	location: z.string().nullable(),
	verified: z.boolean(),
	description: z.string().nullable().describe(`First ${CLUB_DESCRIPTION_CHARS} characters`),
	memberCount: z.number().describe("Active members"),
	rating: ratingSchema.describe("Average of the club's reviews"),
	nextGame: nextGameSchema.describe("Soonest upcoming public event"),
	_count: z.object({ members: z.number() }),
});

// Kept as the partial user row it always was, so existing consumers still typecheck. Only id, name, slug,
// image, callsign, matchedIn and mainClub are ever sent.
export const userSearchDataSchema = createSelectSchema(user)
	.partial()
	.extend({
		matchedIn: z
			.enum(["name", "callsign", "bio"])
			.nullable()
			.describe("Which field matched the query; null without a query"),
		mainClub: userClubSchema.nullable().describe("The user's oldest active membership of a public club"),
	});

export const eventSearchDataSchema = baseEventSchema
	.partial()
	.extend({
		club: z
			.object({
				id: z.string(),
				name: z.string(),
				slug: z.string().nullable(),
				logo: z.string().nullable(),
				verified: z.boolean(),
			})
			.nullable(),
		attendeeCount: z.number(),
		placesLeft: z.number().nullable(),
	})
	.describe("Event fields; attendeeCount is the number of CONFIRMED attendees");

const searchItemBase = { id: z.string(), name: z.string(), relevanceScore: z.number() };

export const searchItemSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("club"), ...searchItemBase, data: clubSearchDataSchema }),
	z.object({ type: z.literal("user"), ...searchItemBase, data: userSearchDataSchema }),
	z.object({ type: z.literal("event"), ...searchItemBase, data: eventSearchDataSchema }),
]);
export type SearchItem = z.infer<typeof searchItemSchema>;

export interface SearchOptions {
	search: string;
	candidateLimit: number;
	countryId?: number;
	upcomingOnly: boolean;
	registrationOpen: boolean;
	verifiedOnly: boolean;
	viewer: { userId?: string; isAdmin?: boolean };
}

interface TypeResult {
	total: number;
	items: SearchItem[];
}

function patterns(search: string) {
	const escaped = escapeLike(search);
	return { contains: `%${escaped}%`, prefix: `${escaped}%` };
}

function and2(conditions: Array<SQL | undefined>) {
	return and(...conditions.filter((condition): condition is SQL => condition !== undefined));
}

export async function searchClubs(o: SearchOptions, withItems: boolean): Promise<TypeResult> {
	const { search } = o;
	const { contains, prefix } = patterns(search);
	const where = and2([
		await publicClubCondition(),
		search ? or(ilike(club.name, contains), ilike(club.location, contains)) : undefined,
		o.countryId === undefined ? undefined : eq(club.countryId, o.countryId),
		o.verifiedOnly ? eq(club.verified, true) : undefined,
	]);

	const relevance = search
		? sql<number>`(
			CASE WHEN ${club.name} ILIKE ${contains} THEN 10 ELSE 0 END
			+ CASE WHEN ${club.name} ILIKE ${prefix} THEN 5 ELSE 0 END
			+ CASE WHEN ${club.location} ILIKE ${contains} THEN 3 ELSE 0 END
			+ CASE WHEN ${club.verified} THEN 1 ELSE 0 END
		)`
		: sql<number>`(CASE WHEN ${club.verified} THEN 2 ELSE 1 END)`;

	// Grouped-count join instead of one COUNT query per club.
	const memberCounts = db
		.select({ clubId: clubMembership.clubId, count: count().as("member_count") })
		.from(clubMembership)
		.where(eq(clubMembership.status, "ACTIVE"))
		.groupBy(clubMembership.clubId)
		.as("club_member_counts");

	const [rows, totalRows] = await Promise.all([
		withItems
			? db
					.select({
						id: club.id,
						name: club.name,
						slug: club.slug,
						logo: club.logo,
						logoTile: club.logoTile,
						location: club.location,
						verified: club.verified,
						description: sql<
							string | null
						>`left(${club.description}, ${sql.raw(String(CLUB_DESCRIPTION_CHARS))})`,
						memberCount: sql<number>`COALESCE(${memberCounts.count}, 0)`,
						relevanceScore: relevance,
					})
					.from(club)
					.leftJoin(memberCounts, eq(club.id, memberCounts.clubId))
					.where(where)
					.orderBy(desc(relevance), desc(club.verified), club.name)
					.limit(o.candidateLimit)
			: [],
		db.select({ count: count() }).from(club).where(where),
	]);

	return {
		total: Number(totalRows[0]?.count || 0),
		items: rows.map(({ relevanceScore, memberCount, logoTile, ...c }) => ({
			type: "club" as const,
			id: c.id,
			name: c.name,
			relevanceScore: Number(relevanceScore),
			data: {
				...c,
				logoTile: logoTileOf(logoTile),
				memberCount: Number(memberCount),
				rating: null,
				nextGame: null,
				_count: { members: Number(memberCount) },
			},
		})),
	};
}

export async function searchUsers(o: SearchOptions, withItems: boolean): Promise<TypeResult> {
	const { search } = o;
	const { contains, prefix } = patterns(search);
	const clubOk = await publicClubCondition();
	const inCountry =
		o.countryId === undefined
			? undefined
			: exists(
					db
						.select({ n: sql`1` })
						.from(clubMembership)
						.innerJoin(club, eq(clubMembership.clubId, club.id))
						.where(
							and(
								eq(clubMembership.userId, user.id),
								eq(clubMembership.status, "ACTIVE"),
								clubOk,
								eq(club.countryId, o.countryId),
							),
						),
				);
	const where = and2([
		eq(user.isPrivate, false),
		userNotBanned(o.viewer),
		search ? or(ilike(user.name, contains), ilike(user.callsign, contains), ilike(user.bio, contains)) : undefined,
		inCountry,
	]);

	const relevance = search
		? sql<number>`(
			GREATEST(
				CASE WHEN ${user.name} ILIKE ${contains} THEN 10 ELSE 0 END + CASE WHEN ${user.name} ILIKE ${prefix} THEN 5 ELSE 0 END,
				CASE WHEN ${user.callsign} ILIKE ${contains} THEN 10 ELSE 0 END + CASE WHEN ${user.callsign} ILIKE ${prefix} THEN 5 ELSE 0 END
			)
			+ CASE WHEN ${user.bio} ILIKE ${contains} THEN 2 ELSE 0 END
		)`
		: sql<number>`1`;

	const matchedIn = search
		? sql<"name" | "callsign" | "bio" | null>`(
			CASE
				WHEN ${user.name} ILIKE ${contains} THEN 'name'
				WHEN ${user.callsign} ILIKE ${contains} THEN 'callsign'
				WHEN ${user.bio} ILIKE ${contains} THEN 'bio'
			END
		)`
		: sql<null>`NULL`;

	const [rows, totalRows] = await Promise.all([
		withItems
			? db
					.select({
						id: user.id,
						name: user.name,
						slug: user.slug,
						image: user.image,
						callsign: user.callsign,
						matchedIn,
						relevanceScore: relevance,
					})
					.from(user)
					.where(where)
					// Without a search term every row scores 1; `ORDER BY 1` would be read as a
					// column ordinal by Postgres, so the constant is left out of the ORDER BY.
					.orderBy(...(search ? [desc(relevance)] : []), desc(user.createdAt), user.id)
					.limit(o.candidateLimit)
			: [],
		db.select({ count: count() }).from(user).where(where),
	]);

	return {
		total: Number(totalRows[0]?.count || 0),
		items: rows.map(({ relevanceScore, ...u }) => ({
			type: "user" as const,
			id: u.id,
			name: u.name || "",
			relevanceScore: Number(relevanceScore),
			data: { ...u, mainClub: null },
		})),
	};
}

async function eventVisibility({ userId, isAdmin }: SearchOptions["viewer"]): Promise<SQL | undefined> {
	const publicOnly = and(
		eq(event.isPrivate, false),
		sql`EXISTS (SELECT 1 FROM "Club" c WHERE c."id" = ${event.clubId} AND c."isPrivate" = false)`,
	);
	if (isAdmin) {
		return undefined;
	}
	if (!userId) {
		return publicOnly;
	}
	const memberships = await db
		.select({ clubId: clubMembership.clubId })
		.from(clubMembership)
		.where(and(eq(clubMembership.userId, userId), eq(clubMembership.status, "ACTIVE")));
	const clubIds = memberships.map((m) => m.clubId);
	return clubIds.length > 0 ? or(publicOnly, inArray(event.clubId, clubIds)) : publicOnly;
}

export async function searchEvents(o: SearchOptions, withItems: boolean): Promise<TypeResult> {
	const { search } = o;
	const { contains, prefix } = patterns(search);
	const where = and2([
		search ? or(ilike(event.name, contains), ilike(event.location, contains)) : undefined,
		await eventVisibility(o.viewer),
		await clubListedCondition(),
		o.countryId === undefined ? undefined : eq(club.countryId, o.countryId),
		o.upcomingOnly ? sql`${event.dateStart} >= NOW()` : undefined,
		o.registrationOpen
			? sql`${event.dateRegistrationsOpen} <= NOW() AND ${event.dateRegistrationsClose} >= NOW()`
			: undefined,
	]);

	const relevance = search
		? sql<number>`(
			CASE WHEN ${event.name} ILIKE ${contains} THEN 10 ELSE 0 END
			+ CASE WHEN ${event.name} ILIKE ${prefix} THEN 5 ELSE 0 END
			+ CASE WHEN ${event.location} ILIKE ${contains} THEN 3 ELSE 0 END
		)`
		: sql<number>`1`;

	const [rows, totalRows] = await Promise.all([
		withItems
			? db
					.select({
						id: event.id,
						name: event.name,
						description: event.description,
						image: event.image,
						location: event.location,
						slug: event.slug,
						dateStart: event.dateStart,
						dateEnd: event.dateEnd,
						dateRegistrationsOpen: event.dateRegistrationsOpen,
						dateRegistrationsClose: event.dateRegistrationsClose,
						isPrivate: event.isPrivate,
						allowFreelancers: event.allowFreelancers,
						maxAttendees: event.maxAttendees,
						gearRequirements: event.gearRequirements,
						mapData: event.mapData,
						costPerPerson: event.costPerPerson,
						clubId: event.clubId,
						createdAt: event.createdAt,
						updatedAt: event.updatedAt,
						clubName: club.name,
						clubSlug: club.slug,
						clubLogo: club.logo,
						clubVerified: club.verified,
						relevanceScore: relevance,
					})
					.from(event)
					.innerJoin(club, eq(event.clubId, club.id))
					.where(where)
					// See the users branch: a constant score must not reach the ORDER BY.
					.orderBy(...(search ? [desc(relevance)] : []), event.dateStart, event.id)
					.limit(o.candidateLimit)
			: [],
		db.select({ count: count() }).from(event).innerJoin(club, eq(event.clubId, club.id)).where(where),
	]);

	return {
		total: Number(totalRows[0]?.count || 0),
		items: rows.map(({ relevanceScore, clubName, clubSlug, clubLogo, clubVerified, ...e }) => ({
			type: "event" as const,
			id: e.id,
			name: e.name,
			relevanceScore: Number(relevanceScore),
			data: {
				...e,
				club: { id: e.clubId, name: clubName, slug: clubSlug, logo: clubLogo, verified: clubVerified },
				attendeeCount: 0,
				placesLeft: null,
			},
		})),
	};
}

/** Fills in the figures that cost one batched query per type, for the items on the page only. */
export async function enrichItems(items: SearchItem[]): Promise<SearchItem[]> {
	const idsOf = (type: SearchItem["type"]) => items.filter((item) => item.type === type).map((item) => item.id);

	const [ratings, nextGames, userClubs, attendeeCounts] = await Promise.all([
		loadClubRatings(idsOf("club")),
		loadNextGames(idsOf("club")),
		loadUserClubs(idsOf("user")),
		loadAttendeeCounts(idsOf("event")),
	]);

	return items.map((item): SearchItem => {
		if (item.type === "club") {
			return {
				...item,
				data: { ...item.data, rating: ratings.get(item.id) ?? null, nextGame: nextGames.get(item.id) ?? null },
			};
		}
		if (item.type === "user") {
			const main = userClubs.get(item.id)?.[0];
			const mainClub = main
				? { id: main.id, slug: main.slug, name: main.name, logo: main.logo, logoTile: main.logoTile }
				: null;
			return { ...item, data: { ...item.data, mainClub } };
		}
		const attendeeCount = attendeeCounts.get(item.id) ?? 0;
		return {
			...item,
			data: {
				...item.data,
				attendeeCount,
				placesLeft: placesLeftOf(item.data.maxAttendees ?? null, attendeeCount),
			},
		};
	});
}

/** 3 = exact, 2 = starts with, 1 = contains, 0 = the name did not match (location or bio did). */
function nameTier(item: SearchItem, search: string): number {
	const query = search.toLowerCase();
	const names = [item.name, item.type === "user" ? item.data.callsign : null];
	let tier = 0;
	for (const name of names) {
		const value = name?.toLowerCase();
		if (!value) {
			continue;
		}
		if (value === query) {
			tier = Math.max(tier, 3);
		} else if (value.startsWith(query)) {
			tier = Math.max(tier, 2);
		} else if (value.includes(query)) {
			tier = Math.max(tier, 1);
		}
	}
	return tier;
}

/**
 * The best match by name across types. Rule: an exact name (or callsign) beats a prefix match,
 * which beats a contains match; within a tier, the order of `items` decides (relevance score,
 * then club before user before event). With no name match at all it falls back to `items[0]`.
 * `items` must be the full ranked candidate list, not one page, so the answer never depends on
 * the page. Null without a query or without results.
 */
export function pickTopResult(items: SearchItem[], search: string): SearchItem | null {
	if (!search || items.length === 0) {
		return null;
	}
	let best = items[0] as SearchItem;
	let bestTier = nameTier(best, search);
	for (const item of items) {
		const tier = nameTier(item, search);
		if (tier > bestTier) {
			best = item;
			bestTier = tier;
		}
	}
	return best;
}

function parseTypeFilter(filter: string | undefined) {
	const types = (filter || "club,user,event").split(",").map((f) => f.trim().toLowerCase());
	return { club: types.includes("club"), user: types.includes("user"), event: types.includes("event") };
}

/**
 * Ranks the candidates of every requested type into one list, then enriches only the page and the
 * top result. Every type is counted so the tab counts need only this one call.
 */
export async function runSearch(o: SearchOptions, query: { page: number; perPage: number; filter?: string }) {
	const { page, perPage } = query;
	const offset = (page - 1) * perPage;
	const include = parseTypeFilter(query.filter);

	const [clubs, users, events] = await Promise.all([
		searchClubs(o, include.club),
		searchUsers(o, include.user),
		searchEvents(o, include.event),
	]);

	// Stable sort: within an equal score, per-type DB ordering (and club > user > event
	// type precedence) is preserved.
	const ranked = [...clubs.items, ...users.items, ...events.items].sort(
		(a, b) => b.relevanceScore - a.relevanceScore,
	);
	const top = pickTopResult(ranked, o.search);
	const pageItems = ranked.slice(offset, offset + perPage);
	const enriched = await enrichItems(top ? [...pageItems, top] : pageItems);

	const total =
		(include.club ? clubs.total : 0) + (include.user ? users.total : 0) + (include.event ? events.total : 0);
	return {
		items: enriched.slice(0, pageItems.length),
		counts: { events: events.total, clubs: clubs.total, users: users.total },
		topResult: top ? (enriched[pageItems.length] ?? null) : null,
		pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
	};
}
