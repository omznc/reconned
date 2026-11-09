import { and, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import * as z from "zod";
import { club, event, post, review, user } from "../drizzle/schema";
import { db } from "./db";
import { isFeatureEnabled } from "./feature-flags";
import { loadAttendeeCounts, placesLeftOf } from "./people-stats";
import { logoTileOf, logoTileResponseSchema } from "./schemas";

const TEXT_CHARS = 400;

export const feedClubSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	name: z.string(),
	logo: z.string().nullable(),
	logoTile: logoTileResponseSchema,
	verified: z.boolean(),
});

const feedBase = { id: z.string(), createdAt: z.string(), club: feedClubSchema };

export const feedItemSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("game"),
		...feedBase,
		event: z.object({
			slug: z.string().nullable(),
			name: z.string(),
			description: z.string().describe(`First ${TEXT_CHARS} characters`),
			image: z.string().nullable(),
			location: z.string(),
			dateStart: z.string(),
			dateEnd: z.string(),
			dateRegistrationsOpen: z.string(),
			dateRegistrationsClose: z.string(),
			costPerPerson: z.number(),
			maxAttendees: z.number().nullable(),
			attendeeCount: z.number(),
			placesLeft: z.number().nullable(),
		}),
	}),
	z.object({
		kind: z.literal("post"),
		...feedBase,
		post: z.object({
			title: z.string(),
			content: z.string().describe(`First ${TEXT_CHARS} characters`),
			images: z.array(z.string()),
		}),
	}),
	z.object({
		kind: z.literal("review"),
		...feedBase,
		review: z.object({
			rating: z.number(),
			content: z.string().describe(`First ${TEXT_CHARS} characters`),
			target: z.object({
				type: z.enum(["club", "event"]),
				id: z.string(),
				slug: z.string().nullable(),
				name: z.string(),
			}),
			author: z.object({
				id: z.string(),
				slug: z.string().nullable(),
				name: z.string(),
				image: z.string().nullable(),
			}),
		}),
	}),
]);
export type FeedItem = z.infer<typeof feedItemSchema>;
type FeedKind = FeedItem["kind"];

export const FEED_TYPES = ["all", "games", "posts", "reviews"] as const;
export type FeedType = (typeof FEED_TYPES)[number];

const cursorSchema = z.object({ t: z.string(), k: z.enum(["game", "post", "review"]), id: z.string() });
type Cursor = z.infer<typeof cursorSchema>;

export function encodeCursor(item: FeedItem): string {
	const cursor: Cursor = { t: item.createdAt, k: item.kind, id: item.id };
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | null {
	if (!raw) {
		return null;
	}
	try {
		const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/**
 * The feed order is (createdAt DESC, kind ASC, id DESC), a total order across all three sources.
 * For one source this is "strictly after the cursor": older, or the same instant and later in the
 * kind/id tie-break.
 */
function afterCursor(kind: FeedKind, createdAt: SQL, idColumn: SQL, cursor: Cursor | null): SQL | undefined {
	if (!cursor) {
		return undefined;
	}
	let sameInstant = sql`false`;
	if (kind > cursor.k) {
		sameInstant = sql`true`;
	} else if (kind === cursor.k) {
		sameInstant = sql`${idColumn} < ${cursor.id}`;
	}
	return sql`(${createdAt} < ${cursor.t} OR (${createdAt} = ${cursor.t} AND ${sameInstant}))`;
}

function trim(text: string): string {
	return text.length > TEXT_CHARS ? `${text.slice(0, TEXT_CHARS).trimEnd()}…` : text;
}

const clubColumns = {
	clubId: club.id,
	clubSlug: club.slug,
	clubName: club.name,
	clubLogo: club.logo,
	clubLogoTile: club.logoTile,
	clubVerified: club.verified,
};

function toFeedClub(row: {
	clubId: string;
	clubSlug: string | null;
	clubName: string;
	clubLogo: string | null;
	clubLogoTile: string | null;
	clubVerified: boolean;
}) {
	return {
		id: row.clubId,
		slug: row.clubSlug,
		name: row.clubName,
		logo: row.clubLogo,
		logoTile: logoTileOf(row.clubLogoTile),
		verified: row.clubVerified,
	};
}

async function publicClubCondition(): Promise<SQL | undefined> {
	const onlyVerified = await isFeatureEnabled("ONLY_VERIFIED_CLUBS_VISIBLE");
	return and(
		eq(club.isPrivate, false),
		or(eq(club.banned, false), sql`${club.banned} IS NULL`),
		onlyVerified ? eq(club.verified, true) : undefined,
	);
}

/** New public events that have not finished yet, newest first. */
async function loadGames(limit: number, cursor: Cursor | null, clubOk: SQL | undefined): Promise<FeedItem[]> {
	const rows = await db
		.select({
			id: event.id,
			createdAt: event.createdAt,
			slug: event.slug,
			name: event.name,
			description: event.description,
			image: event.image,
			location: event.location,
			dateStart: event.dateStart,
			dateEnd: event.dateEnd,
			dateRegistrationsOpen: event.dateRegistrationsOpen,
			dateRegistrationsClose: event.dateRegistrationsClose,
			costPerPerson: event.costPerPerson,
			maxAttendees: event.maxAttendees,
			...clubColumns,
		})
		.from(event)
		.innerJoin(club, eq(event.clubId, club.id))
		.where(
			and(
				clubOk,
				eq(event.isPrivate, false),
				sql`${event.dateEnd} >= NOW()`,
				afterCursor("game", sql`${event.createdAt}`, sql`${event.id}`, cursor),
			),
		)
		.orderBy(desc(event.createdAt), desc(event.id))
		.limit(limit);

	const counts = await loadAttendeeCounts(rows.map((row) => row.id));
	return rows.map((row) => {
		const attendeeCount = counts.get(row.id) ?? 0;
		return {
			kind: "game" as const,
			id: row.id,
			createdAt: row.createdAt,
			club: toFeedClub(row),
			event: {
				slug: row.slug,
				name: row.name,
				description: trim(row.description),
				image: row.image,
				location: row.location,
				dateStart: row.dateStart,
				dateEnd: row.dateEnd,
				dateRegistrationsOpen: row.dateRegistrationsOpen,
				dateRegistrationsClose: row.dateRegistrationsClose,
				costPerPerson: row.costPerPerson,
				maxAttendees: row.maxAttendees,
				attendeeCount,
				placesLeft: placesLeftOf(row.maxAttendees, attendeeCount),
			},
		};
	});
}

async function loadPosts(limit: number, cursor: Cursor | null, clubOk: SQL | undefined): Promise<FeedItem[]> {
	const rows = await db
		.select({
			id: post.id,
			createdAt: post.createdAt,
			title: post.title,
			content: post.content,
			images: post.images,
			...clubColumns,
		})
		.from(post)
		.innerJoin(club, eq(post.clubId, club.id))
		.where(
			and(clubOk, eq(post.isPublic, true), afterCursor("post", sql`${post.createdAt}`, sql`${post.id}`, cursor)),
		)
		.orderBy(desc(post.createdAt), desc(post.id))
		.limit(limit);

	return rows.map((row) => ({
		kind: "post" as const,
		id: row.id,
		createdAt: row.createdAt,
		club: toFeedClub(row),
		post: { title: row.title, content: trim(row.content), images: row.images ?? [] },
	}));
}

/**
 * Reviews of public clubs and of public events of public clubs. Reviews of players are not part of
 * the feed: they are about a person, and the player's own page shows them.
 */
async function loadReviews(limit: number, cursor: Cursor | null, clubOk: SQL | undefined): Promise<FeedItem[]> {
	const rows = await db
		.select({
			id: review.id,
			createdAt: review.createdAt,
			rating: review.rating,
			content: review.content,
			reviewType: review.type,
			eventId: event.id,
			eventSlug: event.slug,
			eventName: event.name,
			authorId: user.id,
			authorSlug: user.slug,
			authorName: user.name,
			authorImage: user.image,
			authorIsPrivate: user.isPrivate,
			...clubColumns,
		})
		.from(review)
		.leftJoin(event, eq(review.eventId, event.id))
		.innerJoin(club, eq(club.id, sql`COALESCE(${review.clubId}, ${event.clubId})`))
		.innerJoin(user, eq(review.authorId, user.id))
		.where(
			and(
				clubOk,
				inArray(review.type, ["CLUB", "EVENT"]),
				or(eq(review.type, "CLUB"), eq(event.isPrivate, false)),
				afterCursor("review", sql`${review.createdAt}`, sql`${review.id}`, cursor),
			),
		)
		.orderBy(desc(review.createdAt), desc(review.id))
		.limit(limit);

	return rows.map((row) => {
		const isEvent = row.reviewType === "EVENT";
		return {
			kind: "review" as const,
			id: row.id,
			createdAt: row.createdAt,
			club: toFeedClub(row),
			review: {
				rating: row.rating,
				content: trim(row.content),
				target: isEvent
					? { type: "event" as const, id: row.eventId ?? "", slug: row.eventSlug, name: row.eventName ?? "" }
					: { type: "club" as const, id: row.clubId, slug: row.clubSlug, name: row.clubName },
				author: {
					id: row.authorId,
					slug: row.authorSlug,
					name: row.authorName,
					// Same rule as GET /reviews: the name is public content, a private profile's photo is not.
					image: row.authorIsPrivate ? null : row.authorImage,
				},
			},
		};
	});
}

function timeOf(item: FeedItem): number {
	return new Date(`${item.createdAt.replace(" ", "T")}Z`).getTime();
}

function compareText(a: string, b: string): number {
	if (a === b) {
		return 0;
	}
	return a < b ? -1 : 1;
}

/** Newest first; at the same instant, kind ascending, then id descending. */
function compareFeed(a: FeedItem, b: FeedItem): number {
	return timeOf(b) - timeOf(a) || compareText(a.kind, b.kind) || compareText(b.id, a.id);
}

export async function loadFeed(params: { type: FeedType; cursor?: string; limit: number }) {
	const { type, limit } = params;
	const cursor = decodeCursor(params.cursor);
	const clubOk = await publicClubCondition();
	const reviewsOn = (type === "all" || type === "reviews") && (await isFeatureEnabled("REVIEWS"));
	// One extra row per source tells us whether another page exists.
	const take = limit + 1;

	const [games, posts, reviews] = await Promise.all([
		type === "all" || type === "games" ? loadGames(take, cursor, clubOk) : [],
		type === "all" || type === "posts" ? loadPosts(take, cursor, clubOk) : [],
		reviewsOn ? loadReviews(take, cursor, clubOk) : [],
	]);

	const merged = [...games, ...posts, ...reviews].sort(compareFeed);
	const items = merged.slice(0, limit);
	const last = items[items.length - 1];
	return { items, nextCursor: merged.length > limit && last ? encodeCursor(last) : null };
}
