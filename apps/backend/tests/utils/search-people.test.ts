import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, testDb } from "../helpers/auth";
import { api } from "../helpers/client";
import { addClubReview, addMember, createClub, createEvent, DAY_MS, register } from "../helpers/people";

interface SearchItem {
	type: "club" | "user" | "event";
	id: string;
	name: string;
	// biome-ignore lint/suspicious/noExplicitAny: item data differs per type
	data: any;
}

function tagOf() {
	return `zq${crypto.randomUUID().slice(0, 8)}`;
}

async function search(params: string, cookie?: string) {
	const response = await api(cookie).get(`/api/search?${params}`);
	expect(response.status).toBe(200);
	return response.body as {
		items: SearchItem[];
		counts: { events: number; clubs: number; users: number };
		topResult: SearchItem | null;
		pagination: { total: number };
	};
}

describe("GET /search", () => {
	test("returns per-type counts in one response, whatever the type filter", async () => {
		const tag = tagOf();
		const owner = await createUser({ name: `${tag} owner` });
		const club = await createClub(owner, { name: `${tag} club` });
		await createEvent(owner, club.id, { name: `${tag} game one` });
		await createEvent(owner, club.id, { name: `${tag} game two` });

		const all = await search(`search=${tag}`);
		expect(all.counts).toEqual({ events: 2, clubs: 1, users: 1 });
		expect(all.pagination.total).toBe(4);

		const onlyClubs = await search(`search=${tag}&filter=club`);
		expect(onlyClubs.counts).toEqual({ events: 2, clubs: 1, users: 1 });
		expect(onlyClubs.items.map((i) => i.type)).toEqual(["club"]);
		expect(onlyClubs.pagination.total).toBe(1);

		const paged = await search(`search=${tag}&perPage=1&page=2`);
		expect(paged.items.length).toBe(1);
		expect(paged.counts.events).toBe(2);
	});

	test("topResult prefers an exact name over a prefix and a contains match", async () => {
		const tag = tagOf();
		const owner = await createUser({ name: `${tag} person` });
		await createClub(owner, { name: `Big ${tag} club` });
		await createClub(owner, { name: `${tag} prefix club` });
		const exact = await createClub(owner, { name: tag });

		const result = await search(`search=${tag}`);
		expect(result.topResult?.type).toBe("club");
		expect(result.topResult?.id).toBe(exact.id);

		// Not tied to the page: page 2 still names the same top result.
		const page2 = await search(`search=${tag}&perPage=1&page=2`);
		expect(page2.topResult?.id).toBe(exact.id);

		const noQuery = await search("perPage=2");
		expect(noQuery.topResult).toBeNull();
		const noMatch = await search(`search=${tag}nomatch`);
		expect(noMatch.topResult).toBeNull();
	});

	test("clubs carry description, rating, memberCount and nextGame", async () => {
		const tag = tagOf();
		const owner = await createUser();
		const club = await createClub(owner, { name: `${tag} club`, description: "x".repeat(500) });
		const reviewer = await createUser();
		await addClubReview(reviewer.id, club.id, 5);
		await addClubReview(owner.id, club.id, 4);
		await addMember(reviewer.id, club.id);
		const later = await createEvent(owner, club.id, {
			name: `${tag} later`,
			dateStart: new Date(Date.now() + 20 * DAY_MS).toISOString(),
			dateEnd: new Date(Date.now() + 21 * DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(Date.now() + 19 * DAY_MS).toISOString(),
		});
		const sooner = await createEvent(owner, club.id, { name: `${tag} sooner`, maxAttendees: 10 });
		await register(reviewer, sooner.id);
		expect(later.id).not.toBe(sooner.id);

		const result = await search(`search=${tag}&filter=club`);
		const data = result.items[0]?.data;
		expect(data.description.length).toBe(240);
		expect(data.rating).toEqual({ average: 4.5, count: 2 });
		expect(data.memberCount).toBe(2);
		expect(data._count.members).toBe(2);
		expect(data.nextGame).toMatchObject({
			id: sooner.id,
			name: `${tag} sooner`,
			maxAttendees: 10,
			attendeeCount: 1,
			placesLeft: 9,
		});
	});

	test("a club without reviews or events has null rating and nextGame", async () => {
		const tag = tagOf();
		await createClub(await createUser(), { name: `${tag} lonely` });
		const result = await search(`search=${tag}&filter=club`);
		expect(result.items[0]?.data.rating).toBeNull();
		expect(result.items[0]?.data.nextGame).toBeNull();
		expect(result.items[0]?.data.description).toBeNull();
	});

	test("players match callsign and bio, with a matchedIn hint and their main club", async () => {
		const tag = tagOf();
		const owner = await createUser({ name: "Plain Owner" });
		const club = await createClub(owner, { name: `${tag} home` });
		const byName = await createUser({ name: `${tag} namesake` });
		const byCallsign = await createUser({ name: "Quiet One" });
		const byBio = await createUser({ name: "Other One" });
		await testDb`UPDATE "User" SET callsign = ${`${tag}-ghost`} WHERE id = ${byCallsign.id}`;
		await testDb`UPDATE "User" SET bio = ${`Plays at ${tag} fields`} WHERE id = ${byBio.id}`;
		await addMember(byName.id, club.id);

		const result = await search(`search=${tag}&filter=user`);
		const matched = new Map(result.items.map((i) => [i.id, i.data]));
		expect(matched.get(byName.id)?.matchedIn).toBe("name");
		expect(matched.get(byCallsign.id)?.matchedIn).toBe("callsign");
		expect(matched.get(byBio.id)?.matchedIn).toBe("bio");
		expect(matched.get(byName.id)?.mainClub).toMatchObject({ id: club.id, name: club.name });
		expect(matched.get(byBio.id)?.mainClub).toBeNull();
		expect(result.counts.users).toBe(3);
	});

	test("private players stay out of the results", async () => {
		const tag = tagOf();
		const hidden = await createUser({ name: `${tag} hidden` });
		await testDb`UPDATE "User" SET "isPrivate" = true WHERE id = ${hidden.id}`;
		const result = await search(`search=${tag}`);
		expect(result.counts.users).toBe(0);
	});

	test("verifiedOnly keeps verified clubs", async () => {
		const tag = tagOf();
		const owner = await createUser();
		const verified = await createClub(owner, { name: `${tag} verified` });
		await createClub(owner, { name: `${tag} plain` });
		await testDb`UPDATE "Club" SET verified = true WHERE id = ${verified.id}`;

		const result = await search(`search=${tag}&filter=club&verifiedOnly=true`);
		expect(result.items.map((i) => i.id)).toEqual([verified.id]);
		expect(result.counts.clubs).toBe(1);
		const unfiltered = await search(`search=${tag}&filter=club&verifiedOnly=false`);
		expect(unfiltered.counts.clubs).toBe(2);
	});

	test("countryId narrows clubs, events and players", async () => {
		const tag = tagOf();
		const owner = await createUser({ name: `${tag} owner` });
		const clubIn = await createClub(owner, { name: `${tag} in` });
		const clubOut = await createClub(owner, { name: `${tag} out` });
		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0].id as number;
		await testDb`UPDATE "Club" SET "countryId" = ${countryId} WHERE id = ${clubIn.id}`;
		await testDb`UPDATE "Club" SET "countryId" = NULL WHERE id = ${clubOut.id}`;
		const eventIn = await createEvent(owner, clubIn.id, { name: `${tag} game in` });
		await createEvent(owner, clubOut.id, { name: `${tag} game out` });
		const member = await createUser({ name: `${tag} member` });
		const outsider = await createUser({ name: `${tag} outsider` });
		await addMember(member.id, clubIn.id);
		await addMember(outsider.id, clubOut.id);

		const result = await search(`search=${tag}&countryId=${countryId}`);
		const ids = result.items.map((i) => i.id);
		expect(ids).toContain(clubIn.id);
		expect(ids).toContain(eventIn.id);
		expect(ids).toContain(member.id);
		expect(ids).not.toContain(clubOut.id);
		expect(ids).not.toContain(outsider.id);
		expect(result.counts.clubs).toBe(1);
		expect(result.counts.events).toBe(1);
	});

	test("upcomingOnly and registrationOpen filter events", async () => {
		const tag = tagOf();
		const owner = await createUser();
		const club = await createClub(owner, { name: `${tag} club` });
		const now = Date.now();
		const open = await createEvent(owner, club.id, { name: `${tag} open` });
		const notYetOpen = await createEvent(owner, club.id, {
			name: `${tag} soon`,
			dateRegistrationsOpen: new Date(now + 2 * DAY_MS).toISOString(),
		});
		const finished = await createEvent(owner, club.id, { name: `${tag} finished` });
		await testDb`UPDATE "Event" SET "dateStart" = NOW() - INTERVAL '3 days', "dateEnd" = NOW() - INTERVAL '2 days',
			"dateRegistrationsClose" = NOW() - INTERVAL '4 days' WHERE id = ${finished.id}`;

		const everything = await search(`search=${tag}&filter=event`);
		expect(everything.counts.events).toBe(3);

		const upcoming = await search(`search=${tag}&filter=event&upcomingOnly=true`);
		expect(upcoming.items.map((i) => i.id).sort()).toEqual([open.id, notYetOpen.id].sort());

		const registrable = await search(`search=${tag}&filter=event&registrationOpen=true`);
		expect(registrable.items.map((i) => i.id)).toEqual([open.id]);
		expect(registrable.counts.events).toBe(1);
		expect(registrable.items[0]?.data.attendeeCount).toBe(0);
	});

	test("a banned club and its events are absent from search and from a player's clubs", async () => {
		const tag = tagOf();
		const owner = await createUser({ name: `${tag} owner` });
		const club = await createClub(owner, { name: `${tag} club` });
		await createEvent(owner, club.id, { name: `${tag} game` });
		await testDb`UPDATE "Club" SET banned = true WHERE id = ${club.id}`;

		const result = await search(`search=${tag}`);
		expect(result.counts.clubs).toBe(0);
		expect(result.counts.events).toBe(0);
		expect(result.items.map((i) => i.type)).toEqual(["user"]);

		const players = await api().get(`/api/users?search=${tag}`);
		expect(players.body.users[0].clubs).toEqual([]);
	});

	test("a banned user is hidden from search except for an admin", async () => {
		const tag = tagOf();
		const banned = await createUser({ name: `${tag} banned` });
		await testDb`UPDATE "User" SET banned = true WHERE id = ${banned.id}`;
		const viewer = await createUser();
		const admin = await makeAdmin(await createUser());

		for (const cookie of [undefined, viewer.cookie]) {
			expect((await search(`search=${tag}&filter=user`, cookie)).counts.users).toBe(0);
		}
		const asAdmin = await search(`search=${tag}&filter=user`, admin.cookie);
		expect(asAdmin.items.map((i) => i.id)).toEqual([banned.id]);
	});

	test("the old params keep working", async () => {
		const tag = tagOf();
		const owner = await createUser({ name: `${tag} owner` });
		const club = await createClub(owner, { name: `${tag} club` });
		const result = await search(`search=${tag}&filter=club,event&page=1&perPage=10`);
		expect(result.items.map((i) => i.id)).toEqual([club.id]);
		expect(result.items[0]?.data._count).toEqual({ members: 1 });
		expect(result.pagination.total).toBe(1);
	});
});
