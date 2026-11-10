import { and, count, eq, isNotNull, type SQL, sql } from "drizzle-orm";
import * as z from "zod";
import { club, event, review } from "../drizzle/schema";
import { db } from "./db";
import { isFeatureEnabled } from "./feature-flags";

/** A club someone actually runs: it has an owner. Directory entries do not. */
export const CLAIMED = sql`EXISTS (
	SELECT 1 FROM "ClubMembership" cm
	WHERE cm."clubId" = ${club.id} AND cm."role" = 'CLUB_OWNER' AND cm."status" = 'ACTIVE'
)`;

/** In at least one alliance, by the join table or the legacy flag. */
export const ALLIED = sql`(${club.isAllied} OR EXISTS (
	SELECT 1 FROM "ClubAlliance" ca WHERE ca."clubId" = ${club.id}
))`;

/** Active, non-archived members. Archived rows keep their row but leave `ACTIVE`. */
export const MEMBER_COUNT = sql<number>`(
	SELECT count(*)::int FROM "ClubMembership" mc
	WHERE mc."clubId" = ${club.id} AND mc."status" = 'ACTIVE'
)`;

/** Size buckets by active member count: small < 15, medium 15 to 40, large > 40. */
export const SMALL_CLUB_BELOW = 15;
export const LARGE_CLUB_ABOVE = 40;

export const CLUB_SIZES = ["small", "medium", "large"] as const;
export type ClubSize = (typeof CLUB_SIZES)[number];

const SIZE_CONDITIONS: Record<ClubSize, SQL> = {
	small: sql`${MEMBER_COUNT} < ${SMALL_CLUB_BELOW}`,
	medium: sql`${MEMBER_COUNT} BETWEEN ${SMALL_CLUB_BELOW} AND ${LARGE_CLUB_ABOVE}`,
	large: sql`${MEMBER_COUNT} > ${LARGE_CLUB_ABOVE}`,
};

const SIZE_BUCKET = sql<ClubSize>`CASE
	WHEN ${MEMBER_COUNT} < ${SMALL_CLUB_BELOW} THEN 'small'
	WHEN ${MEMBER_COUNT} <= ${LARGE_CLUB_ABOVE} THEN 'medium'
	ELSE 'large'
END`;

/** A query-string boolean: only the literal strings "true" and "false". */
export const queryBoolean = z.enum(["true", "false"]).transform((value) => value === "true");

/** A comma separated list of integer ids, for example `1,2,5`. */
export const queryIntList = z
	.string()
	.regex(/^\d+(,\d+)*$/, "Expected a comma separated list of numbers")
	.transform((value) => value.split(",").map(Number));

export interface ClubFilters {
	countryIds?: number[];
	city?: string;
	size?: ClubSize;
	verified?: boolean;
	allied?: boolean;
	hasGames?: boolean;
}

type FilterGroup = "country" | "size" | "verified";

function upcomingPublicGame(): SQL {
	return sql`EXISTS (
		SELECT 1 FROM "Event" ev
		WHERE ev."clubId" = ${club.id} AND ev."isPrivate" = false AND ev."dateStart" >= ${new Date().toISOString()}
	)`;
}

function flag(condition: SQL, wanted: boolean): SQL {
	return wanted ? condition : sql`NOT ${condition}`;
}

/** The WHERE fragments for the active filters. `skip` leaves one facet group out of its own count. */
export function buildFilterConditions(filters: ClubFilters, skip?: FilterGroup): SQL[] {
	const conditions: SQL[] = [];

	if (filters.countryIds?.length && skip !== "country") {
		conditions.push(sql`${club.countryId} IN (${sql.join(filters.countryIds, sql`, `)})`);
	}
	if (filters.city) {
		conditions.push(sql`(${club.citySlug} = ${filters.city} OR lower(${club.city}) = lower(${filters.city}))`);
	}
	if (filters.size && skip !== "size") {
		conditions.push(SIZE_CONDITIONS[filters.size]);
	}
	if (filters.verified !== undefined && skip !== "verified") {
		conditions.push(eq(club.verified, filters.verified));
	}
	if (filters.allied !== undefined) {
		conditions.push(flag(ALLIED, filters.allied));
	}
	if (filters.hasGames !== undefined) {
		conditions.push(flag(upcomingPublicGame(), filters.hasGames));
	}

	return conditions;
}

/** One grouped subquery of club review averages, joined into the listing for display and sorting. */
export function clubRatings() {
	return db
		.select({
			clubId: review.clubId,
			average: sql<number>`round(avg(${review.rating})::numeric, 2)::float8`.as("rating_average"),
			count: count().as("rating_count"),
		})
		.from(review)
		.where(isNotNull(review.clubId))
		.groupBy(review.clubId)
		.as("club_ratings");
}

export function toRating(average: number | null, reviewCount: number | null) {
	return average === null ? null : { average: Number(average), count: Number(reviewCount) };
}

export interface ClubFacets {
	country: Array<{ countryId: number; count: number }>;
	size: Record<ClubSize, number>;
	verified: { verified: number; unverified: number };
}

/**
 * Facet counts. Each group counts with every other active filter and the base visibility
 * conditions applied, but not its own filter, so a selected option still shows its siblings.
 */
export async function getClubFacets(base: SQL[], filters: ClubFilters): Promise<ClubFacets> {
	const where = (skip: FilterGroup) => and(...base, ...buildFilterConditions(filters, skip));

	const [countries, sizes, verifiedRows] = await Promise.all([
		db
			.select({ countryId: club.countryId, count: count() })
			.from(club)
			.where(where("country"))
			.groupBy(club.countryId),
		db.select({ bucket: SIZE_BUCKET, count: count() }).from(club).where(where("size")).groupBy(sql`1`),
		db
			.select({ verified: club.verified, count: count() })
			.from(club)
			.where(where("verified"))
			.groupBy(club.verified),
	]);

	const size: Record<ClubSize, number> = { small: 0, medium: 0, large: 0 };
	for (const row of sizes) {
		size[row.bucket] = Number(row.count);
	}

	return {
		country: countries
			.flatMap((row) => (row.countryId === null ? [] : [{ countryId: row.countryId, count: Number(row.count) }]))
			.sort((a, b) => b.count - a.count || a.countryId - b.countryId),
		size,
		verified: {
			verified: Number(verifiedRows.find((row) => row.verified)?.count ?? 0),
			unverified: Number(verifiedRows.find((row) => !row.verified)?.count ?? 0),
		},
	};
}

export interface ClubTotals {
	clubCount: number;
	cityCount: number;
	countryCount: number;
}

/** Header numbers for public clubs only, whatever the viewer or the active filters. */
export async function getPublicClubTotals(): Promise<ClubTotals> {
	const conditions = [eq(club.isPrivate, false)];
	if (await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE")) {
		conditions.push(eq(club.verified, true));
	}

	const rows = await db
		.select({
			clubCount: count(),
			cityCount: sql<number>`count(DISTINCT ${club.citySlug})`,
			countryCount: sql<number>`count(DISTINCT ${club.countryId})`,
		})
		.from(club)
		.where(and(...conditions));

	return {
		clubCount: Number(rows[0]?.clubCount ?? 0),
		cityCount: Number(rows[0]?.cityCount ?? 0),
		countryCount: Number(rows[0]?.countryCount ?? 0),
	};
}

export interface NextGame {
	id: string;
	slug: string | null;
	name: string;
	date: string;
	placesLeft: number | null;
}

/**
 * The soonest upcoming public event of each given club, in one query. `placesLeft` is the
 * capacity minus CONFIRMED attendees, the same headcount the event page uses; null is unlimited.
 */
export async function getNextGames(clubIds: string[]): Promise<Map<string, NextGame>> {
	if (clubIds.length === 0) {
		return new Map();
	}

	const rows = await db
		.selectDistinctOn([event.clubId], {
			clubId: event.clubId,
			id: event.id,
			slug: event.slug,
			name: event.name,
			dateStart: event.dateStart,
			maxAttendees: event.maxAttendees,
			// Spelled out: drizzle drops the table qualifier from a lone-table select list, and an
			// unqualified `id` would bind to EventAttendee's own column.
			taken: sql<number>`(
				SELECT count(*)::int FROM "EventAttendee" ea
				WHERE ea."eventId" = "Event"."id" AND ea."status" = 'CONFIRMED'
			)`,
		})
		.from(event)
		.where(
			and(
				sql`${event.clubId} IN (${sql.join(clubIds, sql`, `)})`,
				eq(event.isPrivate, false),
				sql`${event.dateStart} >= ${new Date().toISOString()}`,
			),
		)
		.orderBy(event.clubId, event.dateStart);

	return new Map(
		rows.map((row) => [
			row.clubId,
			{
				id: row.id,
				slug: row.slug,
				name: row.name,
				date: row.dateStart,
				placesLeft: row.maxAttendees === null ? null : Math.max(0, row.maxAttendees - Number(row.taken)),
			},
		]),
	);
}

export const nextGameSchema = z
	.object({
		id: z.string(),
		slug: z.string().nullable(),
		name: z.string(),
		date: z.string(),
		placesLeft: z.number().nullable().describe("Capacity minus confirmed attendees. Null means unlimited."),
	})
	.nullable();

export const ratingSchema = z
	.object({ average: z.number(), count: z.number() })
	.nullable()
	.describe("Average and number of club reviews. Null when the club has no review.");
