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
	kind: "game" | "post" | "review" | "player_review" | "club" | "alliance" | "claim";
	id: string;
	createdAt: string;
	club?: { id: string; name: string };
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
			const mine = on.items.filter((i) => i.club?.id === club.id);
			expect(mine.length).toBe(2);
			expect(on.items.map((i) => i.club?.id)).not.toContain(privateClub.id);
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

async function seedAlliance(clubId: string) {
	const countries = await api().get("/api/countries");
	const countryId = countries.body[0].id as number;
	const [row] = await testDb`INSERT INTO "Alliance" (name, "countryId", "updatedAt")
		VALUES (${`Feed Alliance ${crypto.randomUUID().slice(0, 6)}`}, ${countryId}, now()) RETURNING id, name`;
	await testDb`INSERT INTO "ClubAlliance" ("clubId", "allianceId") VALUES (${clubId}, ${row?.id})`;
	return { id: row?.id as number, name: row?.name as string };
}

async function seedPlayerReview(authorId: string, userId: string, content: string) {
	const id = crypto.randomUUID();
	await testDb`INSERT INTO "Review" (id, type, rating, content, "authorId", "userId", "updatedAt")
		VALUES (${id}, 'USER', 4, ${content}, ${authorId}, ${userId}, NOW())`;
	return id;
}

describe("GET /public/feed: players, new clubs and alliances", () => {
	test("player reviews need a public reviewed player and a public author", async () => {
		const author = await createUser({ name: "Pub Author" });
		const player = await createUser({ name: "Pub Player" });
		const privatePlayer = await createUser();
		const privateAuthor = await createUser();
		const bannedPlayer = await createUser();
		await testDb`UPDATE "User" SET image = 'https://example.com/p.png' WHERE id IN (${author.id}, ${player.id})`;
		await testDb`UPDATE "User" SET "isPrivate" = true, image = 'https://example.com/x.png' WHERE id IN (${privatePlayer.id}, ${privateAuthor.id})`;
		await testDb`UPDATE "User" SET banned = true WHERE id = ${bannedPlayer.id}`;
		const shown = await seedPlayerReview(author.id, player.id, "Fun to play with");
		const hiddenPlayer = await seedPlayerReview(author.id, privatePlayer.id, "p1");
		const hiddenAuthor = await seedPlayerReview(privateAuthor.id, player.id, "p2");
		const hiddenBanned = await seedPlayerReview(author.id, bannedPlayer.id, "p3");
		await bustFeedCache();

		const { items } = await feed("type=reviews&limit=50");
		const ids = items.map((i) => i.id);
		expect(ids).toContain(shown);
		for (const id of [hiddenPlayer, hiddenAuthor, hiddenBanned]) {
			expect(ids).not.toContain(id);
		}
		const item = items.find((i) => i.id === shown);
		expect(item?.kind).toBe("player_review");
		expect(item?.review).toMatchObject({
			rating: 4,
			content: "Fun to play with",
			player: { id: player.id, name: "Pub Player", image: "https://example.com/p.png" },
			author: { id: author.id, name: "Pub Author" },
		});
		expect(JSON.stringify(items)).not.toContain(player.email);
		expect((await feed("type=posts&limit=50")).items.map((i) => i.id)).not.toContain(shown);
	});

	test("a player review busts the cached feed", async () => {
		const author = await createUser();
		const player = await createUser();
		await feed("type=reviews&limit=5");
		const response = await api(author.cookie).post("/api/reviews", {
			type: "USER",
			userId: player.id,
			rating: 5,
			content: "Cache check",
		});
		expect(response.status).toBe(201);
		const { items } = await feed("type=reviews&limit=5");
		expect(items[0]?.review.content).toBe("Cache check");
	});

	test("a new public club appears under clubs and all, private and banned clubs do not", async () => {
		const owner = await createUser();
		await feed("type=clubs&limit=5");
		const club = await createClub(owner);
		const privateClub = await createClub(owner, { isPrivate: true });
		const bannedClub = await createClub(owner);
		await testDb`UPDATE "Club" SET banned = true, city = 'Tuzla' WHERE id = ${bannedClub.id}`;
		await testDb`UPDATE "Club" SET city = 'Zenica' WHERE id = ${club.id}`;
		await bustFeedCache();

		const clubs = await feed("type=clubs&limit=50");
		const item = clubs.items.find((i) => i.id === club.id);
		expect(item).toMatchObject({ kind: "club", city: "Zenica", club: { id: club.id, name: club.name } });
		const ids = clubs.items.map((i) => i.id);
		expect(ids).not.toContain(privateClub.id);
		expect(ids).not.toContain(bannedClub.id);
		expect((await feed("limit=50")).items.map((i) => i.id)).toContain(club.id);
		expect((await feed("type=games&limit=50")).items.map((i) => i.id)).not.toContain(club.id);
	});

	test("an imported club with no active member is not a new club until someone holds it", async () => {
		const owner = await createUser();
		const imported = await createClub(owner);
		await testDb`DELETE FROM "ClubMembership" WHERE "clubId" = ${imported.id}`;
		await bustFeedCache();
		expect((await feed("type=clubs&limit=50")).items.map((i) => i.id)).not.toContain(imported.id);

		await addMember(owner.id, imported.id, "CLUB_OWNER");
		await bustFeedCache();
		expect((await feed("type=clubs&limit=50")).items.map((i) => i.id)).toContain(imported.id);
	});

	test("creating a club busts the cached feed", async () => {
		const owner = await createUser();
		await feed("type=clubs&limit=5");
		const club = await createClub(owner);
		expect((await feed("type=clubs&limit=5")).items[0]?.id).toBe(club.id);
	});

	test("an alliance join shows the alliance, and hides private and banned clubs", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateClub = await createClub(owner, { isPrivate: true });
		const bannedClub = await createClub(owner);
		await testDb`UPDATE "Club" SET banned = true WHERE id = ${bannedClub.id}`;
		const shown = await seedAlliance(club.id);
		await seedAlliance(privateClub.id);
		await seedAlliance(bannedClub.id);
		await bustFeedCache();

		const { items } = await feed("type=clubs&limit=50");
		const joins = items.filter((i) => i.kind === "alliance");
		const mine = joins.filter((i) => [club.id, privateClub.id, bannedClub.id].includes(i.club?.id ?? ""));
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ club: { id: club.id }, alliance: shown });
	});

	test("clubs that join one alliance on one day are one item, another day is a new item", async () => {
		const owner = await createUser();
		const first = await createClub(owner);
		const second = await createClub(owner);
		const later = await createClub(owner);
		const ally = await seedAlliance(first.id);
		await testDb`INSERT INTO "ClubAlliance" ("clubId", "allianceId") VALUES (${second.id}, ${ally.id}), (${later.id}, ${ally.id})`;
		await testDb`UPDATE "ClubAlliance" SET "createdAt" = '2099-03-04 09:00:00' WHERE "clubId" = ${first.id} AND "allianceId" = ${ally.id}`;
		await testDb`UPDATE "ClubAlliance" SET "createdAt" = '2099-03-04 17:30:00' WHERE "clubId" = ${second.id} AND "allianceId" = ${ally.id}`;
		await testDb`UPDATE "ClubAlliance" SET "createdAt" = '2099-03-06 12:00:00' WHERE "clubId" = ${later.id} AND "allianceId" = ${ally.id}`;
		await bustFeedCache();

		const { items } = await feed("type=clubs&limit=50");
		const joins = items.filter((i) => i.kind === "alliance" && i.alliance.id === ally.id);
		expect(joins).toHaveLength(2);
		const [newer, older] = joins;
		const clubIds = (item: FeedItem | undefined) => (item?.clubs as { id: string }[] | undefined)?.map((c) => c.id);
		expect(clubIds(newer)).toEqual([later.id]);
		expect(clubIds(older)).toEqual([first.id, second.id]);
		expect(older?.createdAt).toStartWith("2099-03-04 17:30:00");
		expect(older?.club?.id).toBe(first.id);
		// The future dates keep these rows above every club the other tests make; take them away again.
		await testDb`DELETE FROM "ClubAlliance" WHERE "allianceId" = ${ally.id}`;
		await bustFeedCache();
	});

	test("a club given to an owner is a claim item, and a private owner stays anonymous", async () => {
		const admin = await createUser();
		const owner = await createUser();
		const hidden = await createUser();
		await testDb`UPDATE "User" SET "isPrivate" = true WHERE id = ${hidden.id}`;
		const claimed = await createClub(admin);
		const quiet = await createClub(admin);
		const objectData = { userId: owner.id, assignedBy: admin.id };
		// Old rows hold the data as a JSON string, so the test writes one row in each form.
		const stringData = JSON.stringify({ userId: hidden.id, assignedBy: admin.id });
		await testDb`INSERT INTO "ClubAuditLog" (id, "clubId", "userId", "actionType", "actionData") VALUES
			(${crypto.randomUUID()}, ${claimed.id}, ${admin.id}, 'CLUB_OWNER_ASSIGNED', ${objectData}),
			(${crypto.randomUUID()}, ${quiet.id}, ${admin.id}, 'CLUB_OWNER_ASSIGNED', to_jsonb(${stringData}::text))`;
		await bustFeedCache();

		const { items } = await feed("type=clubs&limit=50");
		const claims = items.filter((i) => i.kind === "claim");
		expect(claims.find((i) => i.club?.id === claimed.id)?.owner).toMatchObject({ id: owner.id });
		const anonymous = claims.find((i) => i.club?.id === quiet.id);
		expect(anonymous).toBeDefined();
		expect(anonymous?.owner).toBeNull();
	});

	test("saving the same alliances again keeps the join time and adds only the new one", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const first = await seedAlliance(club.id);
		await testDb`UPDATE "ClubAlliance" SET "createdAt" = '2020-01-01 00:00:00' WHERE "clubId" = ${club.id}`;
		const second = await seedAlliance(club.id);
		const countryRows = await testDb`SELECT "countryId" FROM "Alliance" WHERE id = ${first.id}`;
		await testDb`UPDATE "Club" SET "countryId" = ${countryRows[0]?.countryId} WHERE id = ${club.id}`;
		type JoinRow = { allianceId: number; t: string };

		const put = await api(owner.cookie).put(`/api/clubs/${club.id}/alliances`, {
			allianceIds: [first.id, second.id],
		});
		expect(put.status).toBe(200);
		const rows: JoinRow[] =
			await testDb`SELECT "allianceId", "createdAt"::text AS t FROM "ClubAlliance" WHERE "clubId" = ${club.id} ORDER BY "allianceId"`;
		expect(rows).toHaveLength(2);
		expect(rows.find((r) => r.allianceId === first.id)?.t).toStartWith("2020-01-01");
	});

	test("a cursor walk across every kind returns each item once, in order", async () => {
		const owner = await createUser();
		const author = await createUser();
		const player = await createUser();
		const club = await createClub(owner);
		await createPost(owner, club.id);
		await createEvent(owner, club.id);
		await addClubReview(author.id, club.id, 5, "Walk review");
		await seedPlayerReview(author.id, player.id, "Walk player");
		const ally = await seedAlliance(club.id);
		// Force one shared instant so the kind/id tie-break decides the order.
		const tie = "2021-05-05 10:00:00";
		await testDb`UPDATE "Club" SET "createdAt" = ${tie} WHERE id = ${club.id}`;
		await testDb`UPDATE "Post" SET "createdAt" = ${tie} WHERE "clubId" = ${club.id}`;
		await testDb`UPDATE "Review" SET "createdAt" = ${tie} WHERE "authorId" = ${author.id}`;
		await testDb`UPDATE "ClubAlliance" SET "createdAt" = ${tie} WHERE "allianceId" = ${ally.id}`;
		await bustFeedCache();

		const walked: FeedItem[] = [];
		let cursor: string | null = null;
		for (let guard = 0; guard < 500; guard++) {
			const page: { items: FeedItem[]; nextCursor: string | null } = await feed(
				`limit=3${cursor ? `&cursor=${cursor}` : ""}`,
			);
			walked.push(...page.items);
			cursor = page.nextCursor;
			if (!cursor) {
				break;
			}
		}
		expect(cursor).toBeNull();
		const keys = walked.map((i) => `${i.kind}:${i.id}`);
		expect(new Set(keys).size).toBe(keys.length);
		const tied = walked.filter((i) => i.createdAt.startsWith("2021-05-05 10:00:00"));
		const kinds = tied.map((i) => i.kind);
		for (const kind of ["alliance", "club", "player_review", "post", "review"] as const) {
			expect(kinds).toContain(kind);
		}
		expect(kinds).toEqual([...kinds].sort());
		const times = walked.map((i) => Date.parse(`${i.createdAt.replace(" ", "T")}Z`));
		expect(times).toEqual([...times].sort((a, b) => b - a));
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
	test("a banned club is not on the map", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const banned = await createClub(owner);
		await testDb`UPDATE "Club" SET banned = true WHERE id = ${banned.id}`;

		const response = await api().get(`/api/public/clubs/map?bust=${crypto.randomUUID()}`);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).toContain(club.id);
		expect(ids).not.toContain(banned.id);
	});

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
