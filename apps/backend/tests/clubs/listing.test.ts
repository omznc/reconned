import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

interface ListedClub {
	id: string;
	name: string;
	memberCount: number;
	_count: { members: number };
	rating: { average: number; count: number } | null;
	nextGame: { id: string; slug: string | null; name: string; date: string; placesLeft: number | null } | null;
}

async function countryIds(owner: TestUser): Promise<[number, number]> {
	const countries = await api(owner.cookie).get("/api/countries");
	expect(countries.body.length).toBeGreaterThanOrEqual(2);
	return [countries.body[0].id, countries.body[1].id];
}

async function createClub(owner: TestUser, name: string, countryId: number, overrides: Record<string, unknown> = {}) {
	const response = await api(owner.cookie).post("/api/clubs", {
		name,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; slug: string | null };
}

/** Bulk users straight into the table: the size buckets need 41 members. */
async function createBulkUsers(prefix: string, amount: number) {
	await testDb`INSERT INTO "User" (id, email, name, "emailVerified", "updatedAt")
		SELECT ${prefix}::text || g, ${prefix}::text || g || '@example.com', 'Bulk ' || g, true, now()
		FROM generate_series(1, ${amount}::int) g`;
}

/** Adds `amount` of the prefix's bulk users to a club; the first `archived` of them as ARCHIVED. */
async function addMembers(clubId: string, prefix: string, amount: number, archived = 0) {
	await testDb`INSERT INTO "ClubMembership" (id, "userId", "clubId", role, status, "updatedAt")
		SELECT gen_random_uuid()::text, u.id, ${clubId}::text, 'USER',
			CASE WHEN row_number() OVER (ORDER BY u.id) <= ${archived}::int THEN 'ARCHIVED' ELSE 'ACTIVE' END::"MembershipStatus",
			now()
		FROM (SELECT id FROM "User" WHERE id LIKE ${`${prefix}%`} ORDER BY id LIMIT ${amount}::int) u`;
}

async function addReview(clubId: string, rating: number) {
	const author = await createUser();
	await testDb`INSERT INTO "Review" (id, type, rating, content, "authorId", "clubId", "updatedAt")
		VALUES (${crypto.randomUUID()}, 'CLUB', ${rating}, 'Test review', ${author.id}, ${clubId}, now())`;
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Listing Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 0,
		location: "Sarajevo",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		allowFreelancers: true,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string; name: string; slug: string | null };
}

async function register(attendee: TestUser, eventId: string) {
	const response = await api(attendee.cookie).post(`/api/events/${eventId}/registrations`, {
		type: "solo",
		paymentMethod: "cash",
	});
	expect(response.status).toBe(200);
}

async function backdate(eventId: string) {
	await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '2 days', "dateEnd" = NOW() - INTERVAL '1 day' WHERE id = ${eventId}`;
}

function ids(body: { clubs: Array<{ id: string }> }) {
	return body.clubs.map((c) => c.id);
}

describe("clubs listing", () => {
	/**
	 * One fixture for the whole block. Every request narrows by `search=<tag>`, so the shared
	 * test database holds no foreign clubs in these results, and facets count only this set.
	 * Fixtures that bypass the API are written first: the listing is cached and only the API busts it.
	 */
	async function buildFixture() {
		const tag = `Lst${crypto.randomUUID().slice(0, 8)}`;
		const owner = await createUser();
		const [country0, country1] = await countryIds(owner);
		const bulk = `${tag}u`;
		await createBulkUsers(bulk, 41);

		const small = await createClub(owner, `${tag} small`, country0);
		const medium = await createClub(owner, `${tag} medium`, country1);
		const mediumMax = await createClub(owner, `${tag} mediumMax`, country0);
		const large = await createClub(owner, `${tag} large`, country0);
		const privateClub = await createClub(owner, `${tag} private`, country0, { isPrivate: true });

		// Owner is member one. small: 1 + 13 active + 1 archived = 14 active, the top of the small bucket.
		await addMembers(small.id, bulk, 14, 1);
		await addMembers(medium.id, bulk, 14); // 15, the bottom of medium
		await addMembers(mediumMax.id, bulk, 39); // 40, the top of medium
		await addMembers(large.id, bulk, 40); // 41, large

		await testDb`UPDATE "Club" SET verified = true WHERE id = ${large.id}`;
		await testDb`UPDATE "Club" SET city = 'Mostar', "citySlug" = 'mostar' WHERE id = ${medium.id}`;
		// Allied by the legacy flag on one club and by an alliance row on another.
		await testDb`UPDATE "Club" SET "isAllied" = true WHERE id = ${mediumMax.id}`;
		const alliance = await testDb`INSERT INTO "Alliance" (name, "countryId", "updatedAt")
			VALUES (${`${tag} alliance`}, ${country0}, now()) RETURNING id`;
		await testDb`INSERT INTO "ClubAlliance" ("clubId", "allianceId") VALUES (${small.id}, ${alliance[0].id})`;
		// Known creation order: small is oldest, large is newest.
		for (const [index, c] of [small, medium, mediumMax, large].entries()) {
			await testDb`UPDATE "Club" SET "createdAt" = now() - ${`${10 - index} days`}::interval WHERE id = ${c.id}`;
		}

		await addReview(small.id, 5);
		await addReview(small.id, 4);
		await addReview(medium.id, 3);

		return { tag, owner, country0, country1, small, medium, mediumMax, large, privateClub };
	}

	let fixture: ReturnType<typeof buildFixture> | undefined;
	const getFixture = () => {
		fixture ??= buildFixture();
		return fixture;
	};

	const list = async (query: string) => {
		const { tag } = await getFixture();
		const response = await api().get(`/api/clubs?search=${tag}&perPage=50&${query}`);
		expect(response.status).toBe(200);
		return response.body as {
			clubs: ListedClub[];
			totals: { clubCount: number; cityCount: number; countryCount: number };
			facets?: {
				country: Array<{ countryId: number; count: number }>;
				size: { small: number; medium: number; large: number };
				verified: { verified: number; unverified: number };
			};
		};
	};

	describe("memberCount", () => {
		test("counts active members only, and matches _count.members", async () => {
			const f = await getFixture();
			const body = await list("");
			const byId = new Map(body.clubs.map((c) => [c.id, c]));
			expect(byId.get(f.small.id)?.memberCount).toBe(14);
			expect(byId.get(f.small.id)?._count.members).toBe(14);
			expect(byId.get(f.large.id)?.memberCount).toBe(41);
		});
	});

	describe("size filter", () => {
		test("small is under 15 active members", async () => {
			const f = await getFixture();
			expect(ids(await list("size=small"))).toEqual([f.small.id]);
		});

		test("medium is 15 to 40 active members, both ends included", async () => {
			const f = await getFixture();
			expect(ids(await list("size=medium&sortBy=members&sortOrder=asc"))).toEqual([f.medium.id, f.mediumMax.id]);
		});

		test("large is over 40 active members", async () => {
			const f = await getFixture();
			expect(ids(await list("size=large"))).toEqual([f.large.id]);
		});

		test("rejects an unknown size", async () => {
			const response = await api().get("/api/clubs?size=huge");
			expect(response.status).toBe(400);
		});
	});

	describe("country filter", () => {
		test("filters by one country", async () => {
			const f = await getFixture();
			expect(ids(await list(`countryId=${f.country1}`))).toEqual([f.medium.id]);
		});

		test("filters by several countries", async () => {
			const f = await getFixture();
			const body = await list(`countryId=${f.country0},${f.country1}`);
			expect(ids(body)).toHaveLength(4);
		});

		test("rejects a malformed country list", async () => {
			const response = await api().get("/api/clubs?countryId=1,abc");
			expect(response.status).toBe(400);
		});
	});

	describe("city filter", () => {
		test("matches the city slug", async () => {
			const f = await getFixture();
			expect(ids(await list("city=mostar"))).toEqual([f.medium.id]);
		});

		test("matches the city name, ignoring case", async () => {
			const f = await getFixture();
			expect(ids(await list("city=MOSTAR"))).toEqual([f.medium.id]);
		});

		test("returns nothing for a city without clubs", async () => {
			expect(ids(await list("city=nowhere-land"))).toEqual([]);
		});
	});

	describe("verified filter", () => {
		test("verified=true keeps verified clubs", async () => {
			const f = await getFixture();
			expect(ids(await list("verified=true"))).toEqual([f.large.id]);
		});

		test("verified=false drops verified clubs", async () => {
			const f = await getFixture();
			const result = ids(await list("verified=false"));
			expect(result).toHaveLength(3);
			expect(result).not.toContain(f.large.id);
		});
	});

	describe("allied filter", () => {
		test("counts the alliance table and the legacy flag", async () => {
			const f = await getFixture();
			const result = ids(await list("allied=true"));
			expect(result.sort()).toEqual([f.small.id, f.mediumMax.id].sort());
		});

		test("allied=false keeps the clubs in no alliance", async () => {
			const f = await getFixture();
			expect(ids(await list("allied=false")).sort()).toEqual([f.medium.id, f.large.id].sort());
		});

		test("agrees with the map endpoint", async () => {
			const f = await getFixture();
			await testDb`UPDATE "Club" SET latitude = 43.8, longitude = 18.4 WHERE id IN (${f.small.id}, ${f.medium.id})`;
			const map = await api().get("/api/public/clubs/map");
			const mapAllied = new Map(
				(map.body.clubs as Array<{ id: string; isAllied: boolean }>).map((c) => [c.id, c.isAllied]),
			);
			expect(mapAllied.get(f.small.id)).toBe(true);
			expect(mapAllied.get(f.medium.id)).toBe(false);
		});
	});

	describe("hasGames filter", () => {
		test("keeps clubs with an upcoming public event only", async () => {
			const f = await getFixture();
			await createEvent(f.owner, f.medium.id);
			await createEvent(f.owner, f.large.id, { isPrivate: true });
			const past = await createEvent(f.owner, f.small.id);
			await backdate(past.id);

			expect(ids(await list("hasGames=true"))).toEqual([f.medium.id]);
		});

		test("hasGames=false keeps clubs without one", async () => {
			const f = await getFixture();
			await createEvent(f.owner, f.medium.id);
			const result = ids(await list("hasGames=false"));
			expect(result).not.toContain(f.medium.id);
			expect(result).toHaveLength(3);
		});
	});

	describe("sorts", () => {
		test("members, descending by default", async () => {
			const f = await getFixture();
			expect(ids(await list("sortBy=members"))).toEqual([f.large.id, f.mediumMax.id, f.medium.id, f.small.id]);
		});

		test("members, ascending", async () => {
			const f = await getFixture();
			expect(ids(await list("sortBy=members&sortOrder=asc"))).toEqual([
				f.small.id,
				f.medium.id,
				f.mediumMax.id,
				f.large.id,
			]);
		});

		test("newest puts the latest club first", async () => {
			const f = await getFixture();
			expect(ids(await list("sortBy=newest"))).toEqual([f.large.id, f.mediumMax.id, f.medium.id, f.small.id]);
		});

		test("rating puts the best rated club first and unrated clubs last", async () => {
			const f = await getFixture();
			const result = ids(await list("sortBy=rating"));
			expect(result.slice(0, 2)).toEqual([f.small.id, f.medium.id]);
		});

		test("rating ascending still puts unrated clubs last", async () => {
			const f = await getFixture();
			const result = ids(await list("sortBy=rating&sortOrder=asc"));
			expect(result.slice(0, 2)).toEqual([f.medium.id, f.small.id]);
		});

		test("keeps the existing name sort", async () => {
			const f = await getFixture();
			expect(ids(await list("sortBy=name&sortOrder=desc"))[0]).toBe(f.small.id);
		});
	});

	describe("rating field", () => {
		test("reports average and count, or null without reviews", async () => {
			const f = await getFixture();
			const byId = new Map((await list("")).clubs.map((c) => [c.id, c]));
			expect(byId.get(f.small.id)?.rating).toEqual({ average: 4.5, count: 2 });
			expect(byId.get(f.medium.id)?.rating).toEqual({ average: 3, count: 1 });
			expect(byId.get(f.large.id)?.rating).toBeNull();
		});
	});

	describe("nextGame field", () => {
		test("is the soonest upcoming public event with its places left", async () => {
			const f = await getFixture();
			const now = Date.now();
			const later = await createEvent(f.owner, f.medium.id, {
				dateStart: new Date(now + 20 * DAY_MS).toISOString(),
				dateEnd: new Date(now + 21 * DAY_MS).toISOString(),
				dateRegistrationsClose: new Date(now + 19 * DAY_MS).toISOString(),
			});
			const soon = await createEvent(f.owner, f.medium.id, {
				maxAttendees: 10,
				dateStart: new Date(now + 3 * DAY_MS).toISOString(),
				dateEnd: new Date(now + 4 * DAY_MS).toISOString(),
				dateRegistrationsClose: new Date(now + 2 * DAY_MS).toISOString(),
			});
			// Sooner still, but private: never a next game.
			await createEvent(f.owner, f.medium.id, {
				isPrivate: true,
				dateStart: new Date(now + DAY_MS).toISOString(),
				dateEnd: new Date(now + 2 * DAY_MS).toISOString(),
				dateRegistrationsClose: new Date(now + DAY_MS).toISOString(),
			});
			await register(await createUser(), soon.id);
			await register(await createUser(), soon.id);
			await createEvent(f.owner, f.large.id);

			const byId = new Map((await list("")).clubs.map((c) => [c.id, c]));
			expect(byId.get(f.medium.id)?.nextGame).toMatchObject({ id: soon.id, name: soon.name, placesLeft: 8 });
			expect(byId.get(f.medium.id)?.nextGame?.id).not.toBe(later.id);
			// No limit means null, not a number.
			expect(byId.get(f.large.id)?.nextGame?.placesLeft).toBeNull();
			expect(byId.get(f.small.id)?.nextGame).toBeNull();
		});
	});

	describe("facets", () => {
		test("are absent unless asked for", async () => {
			expect((await list("")).facets).toBeUndefined();
		});

		test("count country, size and verified over the visible set", async () => {
			const f = await getFixture();
			const { facets } = await list("facets=true");
			expect(facets?.country).toEqual([
				{ countryId: f.country0, count: 3 },
				{ countryId: f.country1, count: 1 },
			]);
			expect(facets?.size).toEqual({ small: 1, medium: 2, large: 1 });
			expect(facets?.verified).toEqual({ verified: 1, unverified: 3 });
		});

		test("each group ignores its own filter and applies the others", async () => {
			const f = await getFixture();
			const { facets } = await list("facets=true&size=small&verified=false");
			// Size ignores size=small but keeps verified=false: three unverified clubs.
			expect(facets?.size).toEqual({ small: 1, medium: 2, large: 0 });
			// Verified ignores verified=false but keeps size=small: only the one small club.
			expect(facets?.verified).toEqual({ verified: 0, unverified: 1 });
			// Country keeps both filters.
			expect(facets?.country).toEqual([{ countryId: f.country0, count: 1 }]);
		});

		test("never count a private club for an anonymous visitor", async () => {
			const { facets } = await list("facets=true");
			expect(facets?.size.small).toBe(1);
		});
	});

	describe("totals", () => {
		test("count public clubs, cities and countries, whatever the filters", async () => {
			await getFixture();
			const expected = await testDb`SELECT count(*)::int AS clubs, count(DISTINCT "citySlug")::int AS cities,
				count(DISTINCT "countryId")::int AS countries FROM "Club" WHERE "isPrivate" = false`;
			const filtered = await list("size=large");
			expect(filtered.totals).toEqual({
				clubCount: expected[0].clubs,
				cityCount: expected[0].cities,
				countryCount: expected[0].countries,
			});
		});
	});

	describe("privacy", () => {
		test("a private club is hidden from anonymous visitors but not from its member", async () => {
			const f = await getFixture();
			expect(ids(await list(""))).not.toContain(f.privateClub.id);

			const own = await api(f.owner.cookie).get(`/api/clubs?search=${f.tag}&perPage=50`);
			expect(ids(own.body)).toContain(f.privateClub.id);
		});
	});
});

describe("GET /clubs/:id/public-stats", () => {
	async function statsFixture() {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const prefix = `Pst${crypto.randomUUID().slice(0, 8)}u`;
		await createBulkUsers(prefix, 5);
		const club = await createClub(owner, `Stats ${prefix}`, country0);
		// Owner + 4 active (one with a private profile) + 1 archived.
		await addMembers(club.id, prefix, 5, 1);
		await testDb`UPDATE "User" SET "isPrivate" = true WHERE id = ${`${prefix}5`}`;
		return { owner, club, country0 };
	}

	test("counts members and private members, active only", async () => {
		const { club } = await statsFixture();
		const response = await api().get(`/api/clubs/${club.id}/public-stats`);
		expect(response.status).toBe(200);
		expect(response.body.memberCount).toBe(5);
		expect(response.body.privateMemberCount).toBe(1);
	});

	test("resolves a club slug", async () => {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const slug = `stats-${crypto.randomUUID().slice(0, 8)}`;
		await createClub(owner, `Slug ${slug}`, country0, { slug });
		const response = await api().get(`/api/clubs/${slug}/public-stats`);
		expect(response.status).toBe(200);
		expect(response.body.memberCount).toBe(1);
	});

	test("games hosted counts finished public events only", async () => {
		const { owner, club } = await statsFixture();
		for (let i = 0; i < 2; i++) {
			await backdate((await createEvent(owner, club.id)).id);
		}
		await backdate((await createEvent(owner, club.id, { isPrivate: true })).id);
		await createEvent(owner, club.id);

		const response = await api().get(`/api/clubs/${club.id}/public-stats`);
		expect(response.body.gamesHosted).toBe(2);
	});

	test("players hosted counts distinct confirmed users of finished public events", async () => {
		const { owner, club } = await statsFixture();
		const first = await createEvent(owner, club.id);
		const second = await createEvent(owner, club.id);
		const hidden = await createEvent(owner, club.id, { isPrivate: true });
		const upcoming = await createEvent(owner, club.id);
		const [a, b, absent, other] = [await createUser(), await createUser(), await createUser(), await createUser()];

		await register(a, first.id);
		await register(b, first.id);
		await register(a, second.id); // same user twice: counted once
		await register(absent, second.id);
		await register(owner, hidden.id); // private event: not counted
		await register(other, upcoming.id); // not finished: not counted
		await testDb`UPDATE "EventAttendee" SET attended = false WHERE "userId" = ${absent.id}`;
		for (const e of [first, second, hidden]) {
			await backdate(e.id);
		}

		const response = await api().get(`/api/clubs/${club.id}/public-stats`);
		expect(response.body.playersHosted).toBe(2);
	});

	test("rating matches the review aggregate, null without reviews", async () => {
		const { club } = await statsFixture();
		const none = await api().get(`/api/clubs/${club.id}/public-stats`);
		expect(none.body.rating).toBeNull();

		const rated = (await statsFixture()).club;
		await addReview(rated.id, 5);
		await addReview(rated.id, 2);
		const response = await api().get(`/api/clubs/${rated.id}/public-stats`);
		expect(response.body.rating).toEqual({ average: 3.5, count: 2 });
	});

	test("photo count sums images on public posts only", async () => {
		const { club } = await statsFixture();
		await testDb`INSERT INTO "Post" (id, title, content, images, "isPublic", "clubId", "updatedAt") VALUES
			(${crypto.randomUUID()}, 'a', 'a', ARRAY['one.jpg', 'two.jpg'], true, ${club.id}, now()),
			(${crypto.randomUUID()}, 'b', 'b', ARRAY['x.jpg', 'y.jpg', 'z.jpg'], false, ${club.id}, now()),
			(${crypto.randomUUID()}, 'c', 'c', NULL, true, ${club.id}, now())`;
		const response = await api().get(`/api/clubs/${club.id}/public-stats`);
		expect(response.body.photoCount).toBe(2);
	});

	test("isPrivateStats hides the event totals from visitors, not from members or admins", async () => {
		const { owner, club } = await statsFixture();
		await backdate((await createEvent(owner, club.id)).id);
		const update = await api(owner.cookie).put(`/api/clubs/${club.id}`, { isPrivateStats: true });
		expect(update.status).toBe(200);

		const visitor = await api().get(`/api/clubs/${club.id}/public-stats`);
		expect(visitor.body.gamesHosted).toBeNull();
		expect(visitor.body.playersHosted).toBeNull();
		expect(visitor.body.memberCount).toBe(5);

		const member = await api(owner.cookie).get(`/api/clubs/${club.id}/public-stats`);
		expect(member.body.gamesHosted).toBe(1);

		const admin = await makeAdmin(await createUser());
		const asAdmin = await api(admin.cookie).get(`/api/clubs/${club.id}/public-stats`);
		expect(asAdmin.body.gamesHosted).toBe(1);
	});

	test("a private club is a 404 for visitors and readable by its member", async () => {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const club = await createClub(owner, `Hidden ${crypto.randomUUID().slice(0, 8)}`, country0, {
			isPrivate: true,
		});

		expect((await api().get(`/api/clubs/${club.id}/public-stats`)).status).toBe(404);
		expect((await api((await createUser()).cookie).get(`/api/clubs/${club.id}/public-stats`)).status).toBe(404);
		expect((await api(owner.cookie).get(`/api/clubs/${club.id}/public-stats`)).status).toBe(200);
	});

	test("an unknown club is a 404", async () => {
		expect((await api().get("/api/clubs/does-not-exist/public-stats")).status).toBe(404);
	});
});

describe("GET /clubs/:id/public-rules", () => {
	async function addRule(owner: TestUser, clubId: string, name: string) {
		const response = await api(owner.cookie).post(`/api/clubs/${clubId}/rules`, {
			name,
			content: `${name} content`,
		});
		expect(response.status).toBe(200);
		return response.body.rule.id as string;
	}

	test("returns only rules attached to a public event", async () => {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const club = await createClub(owner, `Rules ${crypto.randomUUID().slice(0, 8)}`, country0);
		const clubLevel = await addRule(owner, club.id, "Club level");
		const onPublic = await addRule(owner, club.id, "On public event");
		const onPrivate = await addRule(owner, club.id, "On private event");
		const publicEvent = await createEvent(owner, club.id, { ruleIds: [onPublic] });
		await createEvent(owner, club.id, { isPrivate: true, ruleIds: [onPrivate] });

		const response = await api().get(`/api/clubs/${club.id}/public-rules`);
		expect(response.status).toBe(200);
		const rules = response.body.rules as Array<{ id: string; eventId: string; eventName: string; content: string }>;
		expect(rules.map((r) => r.id)).toEqual([onPublic]);
		expect(rules[0]).toMatchObject({ eventId: publicEvent.id, eventName: publicEvent.name });
		expect(rules.map((r) => r.id)).not.toContain(clubLevel);
	});

	test("the manager-only rule list stays closed to visitors", async () => {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const club = await createClub(owner, `Closed ${crypto.randomUUID().slice(0, 8)}`, country0);
		expect((await api().get(`/api/clubs/${club.id}/rules`)).status).toBe(401);
	});

	test("a private club hides its rules from visitors", async () => {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const club = await createClub(owner, `Secret ${crypto.randomUUID().slice(0, 8)}`, country0, {
			isPrivate: true,
		});
		const rule = await addRule(owner, club.id, "Secret rule");
		await createEvent(owner, club.id, { ruleIds: [rule] });

		expect((await api().get(`/api/clubs/${club.id}/public-rules`)).status).toBe(404);
		const member = await api(owner.cookie).get(`/api/clubs/${club.id}/public-rules`);
		expect(member.status).toBe(200);
		expect(member.body.rules).toHaveLength(1);
	});

	test("drops a rule once its event no longer links it", async () => {
		const owner = await createUser();
		const [country0] = await countryIds(owner);
		const club = await createClub(owner, `Unlink ${crypto.randomUUID().slice(0, 8)}`, country0);
		const rule = await addRule(owner, club.id, "Temporary");
		const event = await createEvent(owner, club.id, { ruleIds: [rule] });
		expect((await api().get(`/api/clubs/${club.id}/public-rules`)).body.rules).toHaveLength(1);

		const now = Date.now();
		const update = await api(owner.cookie).put(`/api/events/${event.id}`, {
			clubId: club.id,
			name: event.name,
			description: "Unlinked",
			costPerPerson: 0,
			location: "Sarajevo",
			dateStart: new Date(now + 7 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
			ruleIds: [],
		});
		expect(update.status).toBe(200);
		expect((await api().get(`/api/clubs/${club.id}/public-rules`)).body.rules).toHaveLength(0);
	});
});
