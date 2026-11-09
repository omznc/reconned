import { describe, expect, test } from "bun:test";
import { createUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";
import { addClubReview, addMember, createClub, createEvent } from "../helpers/people";

// `src/lib/*` opens its DB and Redis connections from process.env at import time, and the harness only
// forces the test values in `beforeAll`. Import them dynamically from inside a test, never at file level.
async function redisClient() {
	const { redis } = await import("../../src/lib/redis");
	return redis;
}

async function bustFeedCache(clubId = "") {
	const { bustReviewCache, bustRouteCache } = await import("../../src/lib/cache-bust");
	await (clubId ? bustReviewCache("club", clubId) : bustRouteCache(["public:feed"]));
}

interface FeedItem {
	kind: "game" | "post" | "review";
	id: string;
	createdAt: string;
	club: { id: string; name: string };
	// biome-ignore lint/suspicious/noExplicitAny: payload differs per kind
	[key: string]: any;
}

async function feed(params = "") {
	const response = await api().get(`/api/public/feed?${params}`);
	expect(response.status).toBe(200);
	return response.body as { items: FeedItem[]; nextCursor: string | null };
}

async function createPost(owner: { cookie: string }, clubId: string, overrides: Record<string, unknown> = {}) {
	const response = await api(owner.cookie).post(`/api/clubs/${clubId}/posts`, {
		title: `Feed post ${crypto.randomUUID().slice(0, 8)}`,
		content: "Some content",
		isPublic: true,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.post as { id: string };
}

async function setReviewsEnabled(enabled: boolean) {
	const existing = await testDb`SELECT id FROM "FeatureFlag" WHERE name = 'REVIEWS' LIMIT 1`;
	if (existing.length > 0) {
		await testDb`UPDATE "FeatureFlag" SET enabled = ${enabled} WHERE name = 'REVIEWS'`;
	} else {
		await testDb`INSERT INTO "FeatureFlag" (id, name, enabled) VALUES (${crypto.randomUUID()}, 'REVIEWS', ${enabled})`;
	}
	await (await redisClient()).del("feature_flag:REVIEWS");
}

describe("GET /public/feed", () => {
	test("lists new public games with their headcount, and only public fields", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const game = await createEvent(owner, club.id, { maxAttendees: 8, description: "d".repeat(900) });

		const { items } = await feed("type=games&limit=50");
		const item = items.find((i) => i.id === game.id);
		expect(item?.kind).toBe("game");
		expect(item?.club).toMatchObject({ id: club.id, name: club.name });
		expect(item?.event).toMatchObject({ name: game.name, maxAttendees: 8, attendeeCount: 0, placesLeft: 8 });
		expect(item?.event.description.length).toBeLessThanOrEqual(401);
		expect(JSON.stringify(item)).not.toContain("contactEmail");
	});

	test("hides private events, events of private clubs and finished events", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateClub = await createClub(owner, { isPrivate: true });
		const privateEvent = await createEvent(owner, club.id, { isPrivate: true });
		const inPrivateClub = await createEvent(owner, privateClub.id);
		const finished = await createEvent(owner, club.id);
		await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '3 days', "dateEnd" = NOW() - INTERVAL '2 days' WHERE id = ${finished.id}`;
		await bustFeedCache();
		const visible = await createEvent(owner, club.id);

		const { items } = await feed("type=games&limit=50");
		const ids = items.map((i) => i.id);
		expect(ids).toContain(visible.id);
		expect(ids).not.toContain(privateEvent.id);
		expect(ids).not.toContain(inPrivateClub.id);
		expect(ids).not.toContain(finished.id);
	});

	test("posts: public posts of public clubs only, newest first, paged by cursor", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateClub = await createClub(owner, { isPrivate: true });
		const first = await createPost(owner, club.id);
		const second = await createPost(owner, club.id);
		const third = await createPost(owner, club.id);
		const draft = await createPost(owner, club.id, { isPublic: false });
		const hidden = await createPost(owner, privateClub.id);

		const top = await feed("type=posts&limit=3");
		expect(top.items.map((i) => i.id)).toEqual([third.id, second.id, first.id]);

		const pageOne = await feed("type=posts&limit=2");
		expect(pageOne.nextCursor).toBeString();
		expect(pageOne.items.map((i) => i.id)).toEqual([third.id, second.id]);
		const pageTwo = await feed(`type=posts&limit=2&cursor=${pageOne.nextCursor}`);
		expect(pageTwo.items[0]?.id).toBe(first.id);
		expect(pageTwo.items.map((i) => i.id)).not.toContain(third.id);

		const all = await feed("type=posts&limit=50");
		const ids = all.items.map((i) => i.id);
		expect(ids).not.toContain(draft.id);
		expect(ids).not.toContain(hidden.id);
		expect(all.items[0]?.post).toMatchObject({ images: [] });
	});

	test("a cursor walk of the mixed feed never repeats or skips an item", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		for (let i = 0; i < 3; i++) {
			await createPost(owner, club.id);
			await createEvent(owner, club.id);
		}

		const full = await feed("limit=50");
		const walked: string[] = [];
		let cursor: string | null = null;
		for (let guard = 0; guard < 100; guard++) {
			const page: { items: FeedItem[]; nextCursor: string | null } = await feed(
				`limit=4${cursor ? `&cursor=${cursor}` : ""}`,
			);
			walked.push(...page.items.map((i) => i.id));
			cursor = page.nextCursor;
			if (!cursor) {
				break;
			}
			if (walked.length >= full.items.length) {
				break;
			}
		}
		expect(walked.slice(0, full.items.length)).toEqual(full.items.map((i) => i.id));
		const times = full.items.map((i) => Date.parse(`${i.createdAt.replace(" ", "T")}Z`));
		expect(times).toEqual([...times].sort((a, b) => b - a));
	});

	test("a new post busts the cached feed", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		await feed("type=posts&limit=5");
		const fresh = await createPost(owner, club.id);
		const { items } = await feed("type=posts&limit=5");
		expect(items[0]?.id).toBe(fresh.id);
	});

	test("an invalid cursor starts from the top and limit is capped", async () => {
		const bad = await feed("cursor=not-a-cursor");
		expect(Array.isArray(bad.items)).toBe(true);
		const tooMany = await api().get("/api/public/feed?limit=500");
		expect(tooMany.status).toBe(400);
	});

	test("reviews appear only while the REVIEWS flag is on, and a review busts the cache", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const author = await createUser({ name: "Review Author" });
		const privateAuthor = await createUser({ name: "Private Author" });
		await testDb`UPDATE "User" SET image = 'https://example.com/a.png', "isPrivate" = true WHERE id = ${privateAuthor.id}`;
		const privateClub = await createClub(owner, { isPrivate: true });

		try {
			await setReviewsEnabled(false);
			await bustFeedCache(club.id);
			const off = await feed("type=reviews&limit=50");
			expect(off.items).toEqual([]);

			await setReviewsEnabled(true);
			await addClubReview(author.id, club.id, 5, "Great club");
			await addClubReview(privateAuthor.id, club.id, 3, "Fine");
			await addClubReview(author.id, privateClub.id, 1, "Secret");
			await bustFeedCache(club.id);

			const on = await feed("type=reviews&limit=50");
			const mine = on.items.filter((i) => i.club.id === club.id);
			expect(mine.length).toBe(2);
			expect(on.items.map((i) => i.club.id)).not.toContain(privateClub.id);
			const great = mine.find((i) => i.review.content === "Great club");
			expect(great?.review).toMatchObject({ rating: 5, target: { type: "club", id: club.id } });
			expect(great?.review.author).toMatchObject({ id: author.id, name: "Review Author" });
			const fine = mine.find((i) => i.review.content === "Fine");
			expect(fine?.review.author.image).toBeNull();
			expect(JSON.stringify(on.items)).not.toContain(author.email);
		} finally {
			await setReviewsEnabled(true);
		}
	});
});

describe("GET /public/stats", () => {
	test("counts only public clubs, public events and public players", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateClub = await createClub(owner, { isPrivate: true });
		await createEvent(owner, club.id);
		await createEvent(owner, club.id, { isPrivate: true });
		await createEvent(owner, privateClub.id);
		const hidden = await createUser();
		await testDb`UPDATE "User" SET "isPrivate" = true WHERE id = ${hidden.id}`;

		await (await redisClient()).del("public:stats");
		const response = await api().get("/api/public/stats");
		expect(response.status).toBe(200);

		const [clubs] = await testDb`SELECT count(*)::int AS n FROM "Club" WHERE "isPrivate" = false`;
		const [players] = await testDb`SELECT count(*)::int AS n FROM "User" WHERE "isPrivate" = false`;
		const [events] = await testDb`SELECT count(*)::int AS n FROM "Event" e JOIN "Club" c ON c.id = e."clubId"
			WHERE e."isPrivate" = false AND c."isPrivate" = false`;
		expect(response.body.stats).toEqual({ clubs: clubs.n, players: players.n, events: events.n });
		await (await redisClient()).del("public:stats");
	});
});

describe("GET /public/clubs/map", () => {
	test("each club carries countryId, city and memberCount", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0].id as number;
		await testDb`UPDATE "Club" SET city = 'Mapville', "citySlug" = 'mapville', "countryId" = ${countryId} WHERE id = ${club.id}`;
		await addMember((await createUser()).id, club.id);
		await addMember((await createUser()).id, club.id, "USER", "ARCHIVED");

		const response = await api().get(`/api/public/clubs/map?bust=${crypto.randomUUID()}`);
		const found = response.body.clubs.find((c: { id: string }) => c.id === club.id);
		expect(found).toMatchObject({ city: "Mapville", citySlug: "mapville", countryId });
		// The owner and one active member; the archived membership does not count.
		expect(found.memberCount).toBe(2);
	});
});
