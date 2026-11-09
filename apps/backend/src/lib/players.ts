import { and, count, eq, exists, ilike, or, type SQL, sql } from "drizzle-orm";
import { club, clubMembership, user } from "../drizzle/schema";
import { db } from "./db";
import {
	gamesCountSql,
	loadUserClubs,
	statsHiddenSql,
	toRating,
	userRatingAverageSql,
	userRatingCountSql,
} from "./people-stats";

export type PlayerSort = "admin" | "games" | "name" | "newest";

export interface PlayerListQuery {
	page: number;
	perPage: number;
	search?: string;
	sort?: PlayerSort;
	countryId?: number;
	clubId?: string;
	city?: string;
}

export interface Viewer {
	userId?: string;
	isAdmin?: boolean;
}

/**
 * Users carry no country or city of their own, so these filters look at the clubs a player is an
 * active member of: the player matches when ONE public club satisfies every given filter.
 */
function clubFilterCondition(query: PlayerListQuery): SQL | undefined {
	const { countryId, clubId, city } = query;
	if (countryId === undefined && !clubId && !city) {
		return undefined;
	}

	const conditions = [
		eq(clubMembership.userId, user.id),
		eq(clubMembership.status, "ACTIVE"),
		eq(club.isPrivate, false),
	];
	if (countryId !== undefined) {
		conditions.push(eq(club.countryId, countryId));
	}
	if (clubId) {
		const byIdOrSlug = or(eq(club.id, clubId), eq(club.slug, clubId));
		if (byIdOrSlug) {
			conditions.push(byIdOrSlug);
		}
	}
	if (city) {
		const byNameOrSlug = or(sql`lower(${club.city}) = lower(${city})`, eq(club.citySlug, city.toLowerCase()));
		if (byNameOrSlug) {
			conditions.push(byNameOrSlug);
		}
	}

	return exists(
		db
			.select({ n: sql`1` })
			.from(clubMembership)
			.innerJoin(club, eq(clubMembership.clubId, club.id))
			.where(and(...conditions)),
	);
}

function visibilityCondition(viewer: Viewer): SQL | undefined {
	if (viewer.isAdmin) {
		return undefined;
	}
	return viewer.userId ? or(eq(user.isPrivate, false), eq(user.id, viewer.userId)) : eq(user.isPrivate, false);
}

function searchCondition(search: string | undefined, viewer: Viewer): SQL | undefined {
	if (!search) {
		return undefined;
	}
	const pattern = `%${search}%`;
	// Email only for admins: on a public list it tells anyone whether an address has an account.
	if (viewer.isAdmin) {
		return or(ilike(user.name, pattern), ilike(user.email, pattern), ilike(user.callsign, pattern));
	}
	return or(ilike(user.name, pattern), ilike(user.callsign, pattern));
}

/** Every order ends on the id, so equal names or counts cannot shuffle rows between pages. */
function orderByFor(sort: PlayerSort | undefined, games: SQL<number | null>): SQL[] {
	switch (sort) {
		case "admin":
			return [sql`CASE WHEN ${user.role} = 'admin' THEN 0 ELSE 1 END`, sql`${user.name} ASC`, sql`${user.id}`];
		case "games":
			return [sql`${games} DESC NULLS LAST`, sql`${user.name} ASC`, sql`${user.id}`];
		case "newest":
			return [sql`${user.createdAt} DESC`, sql`${user.id}`];
		default:
			return [sql`${user.name} ASC`, sql`${user.id}`];
	}
}

function maskedContact(
	column: typeof user.email | typeof user.phone,
	privateFlag: typeof user.isPrivateEmail | typeof user.isPrivatePhone,
	viewer: Viewer,
) {
	if (viewer.isAdmin) {
		return sql<string | null>`${column}`;
	}
	if (viewer.userId) {
		return sql<
			string | null
		>`CASE WHEN ${user.id} = ${viewer.userId} OR ${privateFlag} = false THEN ${column} ELSE NULL END`;
	}
	return sql<string | null>`CASE WHEN ${privateFlag} = false THEN ${column} ELSE NULL END`;
}

/**
 * The public players listing. The page is cut from the `User` table alone (memberships, games and
 * ratings are correlated subqueries or a second batched query), so `LIMIT` always counts players.
 * It used to cut a user-to-membership join, which dropped or repeated players across pages.
 */
export async function listPlayers(query: PlayerListQuery, viewer: Viewer) {
	const { page, perPage } = query;
	const where = and(visibilityCondition(viewer), searchCondition(query.search, viewer), clubFilterCondition(query));

	const statsHidden = statsHiddenSql(user.isPrivateStats, user.id, viewer);
	const games = sql<number | null>`CASE WHEN ${statsHidden} THEN NULL ELSE ${gamesCountSql()} END`;

	const [rows, totalRows] = await Promise.all([
		db
			.select({
				id: user.id,
				slug: user.slug,
				name: user.name,
				bio: user.bio,
				image: user.image,
				headerImage: user.headerImage,
				location: user.location,
				website: user.website,
				callsign: user.callsign,
				isPrivate: user.isPrivate,
				isPrivateEmail: user.isPrivateEmail,
				isPrivatePhone: user.isPrivatePhone,
				isPrivateStats: user.isPrivateStats,
				language: user.language,
				role: user.role,
				createdAt: user.createdAt,
				email: maskedContact(user.email, user.isPrivateEmail, viewer).as("email"),
				phone: maskedContact(user.phone, user.isPrivatePhone, viewer).as("phone"),
				gamesCount: games.as("games_count"),
				ratingAverage: sql<
					number | null
				>`CASE WHEN ${statsHidden} THEN NULL ELSE ${userRatingAverageSql()} END`.as("rating_average"),
				ratingCount: sql<number>`${userRatingCountSql()}`.as("rating_count"),
			})
			.from(user)
			.where(where)
			.orderBy(...orderByFor(query.sort, games))
			.limit(perPage)
			.offset((page - 1) * perPage),
		db.select({ value: count() }).from(user).where(where),
	]);

	const memberships = await loadUserClubs(rows.map((row) => row.id));
	const total = Number(totalRows[0]?.value ?? 0);

	const users = rows.map(({ ratingAverage, ratingCount, gamesCount, role, ...rest }) => {
		const clubs = (memberships.get(rest.id) ?? []).map(
			({ role: _role, membershipId: _membershipId, ...clubInfo }) => clubInfo,
		);
		return {
			...rest,
			role,
			language: rest.language || "en",
			isAdmin: role?.toUpperCase() === "ADMIN",
			// Same shape as before: only plain-member rows. `clubs` below carries every role.
			clubMembership: (memberships.get(rest.id) ?? [])
				.filter((m) => m.role === "USER")
				.map((m) => ({
					id: m.membershipId,
					clubId: m.id,
					role: m.role,
					club: { id: m.id, name: m.name, slug: m.slug },
				})),
			clubs,
			gamesCount: gamesCount === null ? null : Number(gamesCount),
			rating: ratingAverage === null ? null : toRating(ratingAverage, Number(ratingCount)),
		};
	});

	return {
		users,
		pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
	};
}
