import { and, count, eq, inArray, sql } from "drizzle-orm";
import * as z from "zod";
import { club, clubMembership, event, eventAttendee, review, type user } from "../drizzle/schema";
import { db } from "./db";
import { publicClubCondition } from "./public-club";
import { logoTileOf, logoTileResponseSchema } from "./schemas";

export const ratingSchema = z.object({ average: z.number(), count: z.number() }).nullable();
export type Rating = z.infer<typeof ratingSchema>;

export const userClubSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	name: z.string(),
	logo: z.string().nullable(),
	logoTile: logoTileResponseSchema,
});
export type UserClub = z.infer<typeof userClubSchema>;

/**
 * Games played: places held (CONFIRMED) at events that have finished, in public clubs and public
 * events, unless the roster marks the person as absent. `attended` is null until a manager marks
 * the roster, so null still counts: the person held a place and nobody said they stayed home.
 * Correlated on the outer query's "User" row, so one query can select, filter and sort on it.
 */
export function gamesCountSql() {
	return sql<number>`(
		SELECT count(*)::int
		FROM "EventAttendee" ea
		JOIN "Event" e ON e."id" = ea."eventId"
		JOIN "Club" c ON c."id" = e."clubId"
		WHERE ea."userId" = "User"."id"
			AND ea."status" = 'CONFIRMED'
			AND ea."attended" IS DISTINCT FROM false
			AND e."dateEnd" < NOW()
			AND e."isPrivate" = false
			AND c."isPrivate" = false
	)`;
}

/** Average of the reviews written about a player, rounded to two places, or null with none. */
export function userRatingAverageSql() {
	return sql<number | null>`(
		SELECT round(avg(r."rating")::numeric, 2)::float8 FROM "Review" r
		WHERE r."type" = 'USER' AND r."userId" = "User"."id"
	)`;
}

export function userRatingCountSql() {
	return sql<number>`(
		SELECT count(*)::int FROM "Review" r WHERE r."type" = 'USER' AND r."userId" = "User"."id"
	)`;
}

export function toRating(average: number | null, total: number): Rating {
	return average === null || total === 0 ? null : { average: Number(average), count: Number(total) };
}

/** Player stats are hidden from everyone but the player and admins when `isPrivateStats` is on. */
export function statsHiddenSql(
	statsFlag: typeof user.isPrivateStats,
	userId: typeof user.id,
	viewer: { userId?: string; isAdmin?: boolean },
) {
	if (viewer.isAdmin) {
		return sql<boolean>`false`;
	}
	return sql<boolean>`(${statsFlag} AND ${userId} IS DISTINCT FROM ${viewer.userId ?? ""})`;
}

/**
 * Active memberships of public clubs, every role, for a set of users in one query. Each user's
 * list runs oldest membership first, so the first entry is the user's main club.
 */
export async function loadUserClubs(
	userIds: string[],
): Promise<Map<string, Array<UserClub & { role: string; membershipId: string }>>> {
	const result = new Map<string, Array<UserClub & { role: string; membershipId: string }>>();
	if (userIds.length === 0) {
		return result;
	}

	const clubOk = await publicClubCondition();
	const rows = await db
		.select({
			userId: clubMembership.userId,
			role: clubMembership.role,
			membershipId: clubMembership.id,
			id: club.id,
			slug: club.slug,
			name: club.name,
			logo: club.logo,
			logoTile: club.logoTile,
		})
		.from(clubMembership)
		.innerJoin(club, eq(clubMembership.clubId, club.id))
		.where(and(inArray(clubMembership.userId, userIds), eq(clubMembership.status, "ACTIVE"), clubOk))
		.orderBy(sql`COALESCE(${clubMembership.startDate}, ${clubMembership.createdAt})`, club.name);

	for (const { userId, logoTile, ...rest } of rows) {
		const list = result.get(userId) ?? [];
		list.push({ ...rest, logoTile: logoTileOf(logoTile) });
		result.set(userId, list);
	}
	return result;
}

/** CONFIRMED attendees per event: the same headcount the events routes use for capacity. */
export async function loadAttendeeCounts(eventIds: string[]): Promise<Map<string, number>> {
	if (eventIds.length === 0) {
		return new Map();
	}
	const rows = await db
		.select({ eventId: eventAttendee.eventId, value: count() })
		.from(eventAttendee)
		.where(and(inArray(eventAttendee.eventId, eventIds), eq(eventAttendee.status, "CONFIRMED")))
		.groupBy(eventAttendee.eventId);
	return new Map(rows.map((row) => [row.eventId, Number(row.value)]));
}

export function placesLeftOf(maxAttendees: number | null, attendeeCount: number) {
	return maxAttendees === null ? null : Math.max(0, maxAttendees - attendeeCount);
}

/** Club ratings: the average of the CLUB-type reviews, for a set of clubs in one query. */
export async function loadClubRatings(clubIds: string[]): Promise<Map<string, Rating>> {
	if (clubIds.length === 0) {
		return new Map();
	}
	const rows = await db
		.select({
			clubId: review.clubId,
			average: sql<number>`round(avg(${review.rating})::numeric, 2)::float8`,
			total: count(),
		})
		.from(review)
		.where(and(inArray(review.clubId, clubIds), eq(review.type, "CLUB")))
		.groupBy(review.clubId);
	const map = new Map<string, Rating>();
	for (const row of rows) {
		if (row.clubId) {
			map.set(row.clubId, toRating(row.average, Number(row.total)));
		}
	}
	return map;
}

export const nextGameSchema = z
	.object({
		id: z.string(),
		slug: z.string().nullable(),
		name: z.string(),
		dateStart: z.string(),
		location: z.string(),
		maxAttendees: z.number().nullable(),
		attendeeCount: z.number(),
		placesLeft: z.number().nullable(),
	})
	.nullable();
export type NextGame = z.infer<typeof nextGameSchema>;

/** The soonest upcoming public event of each club, with its headcount. Two queries in total. */
export async function loadNextGames(clubIds: string[]): Promise<Map<string, NextGame>> {
	if (clubIds.length === 0) {
		return new Map();
	}
	const clubOk = await publicClubCondition();
	const rows = await db
		.selectDistinctOn([event.clubId], {
			clubId: event.clubId,
			id: event.id,
			slug: event.slug,
			name: event.name,
			dateStart: event.dateStart,
			location: event.location,
			maxAttendees: event.maxAttendees,
		})
		.from(event)
		.innerJoin(club, eq(event.clubId, club.id))
		.where(
			and(inArray(event.clubId, clubIds), eq(event.isPrivate, false), sql`${event.dateStart} >= NOW()`, clubOk),
		)
		.orderBy(event.clubId, event.dateStart);

	const counts = await loadAttendeeCounts(rows.map((row) => row.id));
	const map = new Map<string, NextGame>();
	for (const { clubId, ...game } of rows) {
		const attendeeCount = counts.get(game.id) ?? 0;
		map.set(clubId, { ...game, attendeeCount, placesLeft: placesLeftOf(game.maxAttendees, attendeeCount) });
	}
	return map;
}
