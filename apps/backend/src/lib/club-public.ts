import { apiError } from "@reconned/router";
import { and, eq, or, sql } from "drizzle-orm";
import { club, clubMembership, clubRule, event, eventAttendee, review, user } from "../drizzle/schema";
import { getActiveMembership } from "./club-access";
import { db } from "./db";
import { isFeatureEnabled } from "./feature-flags";

interface Viewer {
	user?: { id: string } | null;
	isAdmin?: boolean;
}

/**
 * The club behind a public club page, by id or slug. Throws 404 under the same rules as
 * `GET /clubs/:id`: a private club shows only to its members, and with the verified-only flag on
 * an unverified club shows only to admins and its members.
 */
export async function loadVisibleClub(idOrSlug: string, viewer: Viewer) {
	const rows = await db
		.select()
		.from(club)
		.where(or(eq(club.id, idOrSlug), eq(club.slug, idOrSlug)))
		.limit(1);
	const found = rows[0];
	if (!found) {
		throw apiError.notFound("Club not found");
	}

	const membership = viewer.user ? await getActiveMembership(found.id, viewer.user.id) : null;
	if (found.isPrivate && !membership) {
		throw apiError.notFound("Club not found");
	}

	if (!(viewer.isAdmin || found.verified || membership) && (await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE"))) {
		throw apiError.notFound("Club not found");
	}

	return { club: found, isMember: !!membership };
}

export interface ClubPublicStats {
	memberCount: number;
	privateMemberCount: number;
	gamesHosted: number | null;
	playersHosted: number | null;
	rating: { average: number; count: number } | null;
	photoCount: number;
}

const finishedPublicEvents = (clubId: string) =>
	and(eq(event.clubId, clubId), eq(event.isPrivate, false), sql`${event.dateEnd} < ${new Date().toISOString()}`);

async function countMembers(clubId: string) {
	const rows = await db
		.select({
			total: sql<number>`count(*)::int`,
			hidden: sql<number>`(count(*) FILTER (WHERE ${user.isPrivate}))::int`,
		})
		.from(clubMembership)
		.innerJoin(user, eq(clubMembership.userId, user.id))
		.where(and(eq(clubMembership.clubId, clubId), eq(clubMembership.status, "ACTIVE")));
	return { memberCount: rows[0]?.total ?? 0, privateMemberCount: rows[0]?.hidden ?? 0 };
}

/**
 * Past-event totals. A game is hosted when it is public and its `dateEnd` has passed.
 * A player is hosted when a user holds a CONFIRMED place at such a game and was not marked
 * absent (`attended` is not false). Each user counts once, however many games they joined.
 */
async function countHosted(clubId: string) {
	const rows = await db
		.select({
			games: sql<number>`count(DISTINCT ${event.id})::int`,
			players: sql<number>`count(DISTINCT ${eventAttendee.userId})::int`,
		})
		.from(event)
		.leftJoin(
			eventAttendee,
			and(
				eq(eventAttendee.eventId, event.id),
				eq(eventAttendee.status, "CONFIRMED"),
				sql`${eventAttendee.attended} IS NOT FALSE`,
			),
		)
		.where(finishedPublicEvents(clubId));
	return { gamesHosted: rows[0]?.games ?? 0, playersHosted: rows[0]?.players ?? 0 };
}

async function clubRating(clubId: string) {
	const rows = await db
		.select({
			average: sql<number | null>`round(avg(${review.rating})::numeric, 2)::float8`,
			count: sql<number>`count(*)::int`,
		})
		.from(review)
		.where(eq(review.clubId, clubId));
	const row = rows[0];
	return row && row.count > 0 && row.average !== null ? { average: row.average, count: row.count } : null;
}

/** Images on the club's public posts. Instagram media is fetched live and is not counted. */
async function countPhotos(clubId: string) {
	const rows = await db.execute<{ photos: number }>(
		sql`SELECT COALESCE(SUM(cardinality("images")), 0)::int AS photos FROM "Post" WHERE "clubId" = ${clubId} AND "isPublic" = true`,
	);
	return Number(rows[0]?.photos ?? 0);
}

/** `hideEventStats` is the club's `isPrivateStats` for a viewer who is not a member or admin. */
export async function getClubPublicStats(clubId: string, hideEventStats: boolean): Promise<ClubPublicStats> {
	const [members, hosted, rating, photoCount] = await Promise.all([
		countMembers(clubId),
		hideEventStats ? null : countHosted(clubId),
		clubRating(clubId),
		countPhotos(clubId),
	]);

	return {
		...members,
		gamesHosted: hosted?.gamesHosted ?? null,
		playersHosted: hosted?.playersHosted ?? null,
		rating,
		photoCount,
	};
}

/**
 * Rules a visitor may read. Rules have no public flag, so the only rules already public are the
 * ones attached to a public event (shown on that event page). Club-level rules and rules of a
 * private event stay manager-only.
 */
export async function getPublicClubRules(clubId: string) {
	return db
		.select({
			id: clubRule.id,
			name: clubRule.name,
			description: clubRule.description,
			content: clubRule.content,
			updatedAt: clubRule.updatedAt,
			eventId: event.id,
			eventName: event.name,
			eventSlug: event.slug,
		})
		.from(clubRule)
		.innerJoin(event, eq(clubRule.eventId, event.id))
		.where(and(eq(clubRule.clubId, clubId), eq(event.isPrivate, false)))
		.orderBy(sql`${event.dateStart} DESC`, clubRule.name);
}
