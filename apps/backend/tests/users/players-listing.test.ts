import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, testDb } from "../helpers/auth";
import { api } from "../helpers/client";
import { addMember, addUserReview, createClub, createEvent, playFinishedGame, register } from "../helpers/people";

interface Player {
	id: string;
	name: string;
	gamesCount: number | null;
	rating: { average: number; count: number } | null;
	clubs: Array<{ id: string; name: string; slug: string | null; logo: string | null }>;
	clubMembership: Array<{ role: string; club: { id: string } }>;
}

function marker() {
	return `Zlist${crypto.randomUUID().slice(0, 8)}`;
}

async function list(query: string, cookie?: string) {
	const response = await api(cookie).get(`/api/users?${query}`);
	expect(response.status).toBe(200);
	return response.body as { users: Player[]; pagination: { total: number; totalPages: number } };
}

describe("GET /users players listing", () => {
	test("paging counts players, not membership rows", async () => {
		const tag = marker();
		const owner = await createUser();
		const clubA = await createClub(owner);
		const clubB = await createClub(owner);
		const players = [];
		for (let i = 0; i < 5; i++) {
			const player = await createUser({ name: `${tag} P${i}` });
			// Two memberships each: the old join returned two rows per player and cut pages in the middle.
			await addMember(player.id, clubA.id);
			await addMember(player.id, clubB.id);
			players.push(player);
		}

		const seen: string[] = [];
		for (const page of [1, 2, 3]) {
			const result = await list(`search=${tag}&perPage=2&page=${page}`);
			expect(result.pagination.total).toBe(5);
			expect(result.pagination.totalPages).toBe(3);
			expect(result.users.length).toBe(page === 3 ? 1 : 2);
			seen.push(...result.users.map((u) => u.id));
		}
		expect(seen.length).toBe(5);
		expect(new Set(seen)).toEqual(new Set(players.map((p) => p.id)));
	});

	test("a banned user is listed only for an admin", async () => {
		const tag = marker();
		const banned = await createUser({ name: `${tag} Banned` });
		await testDb`UPDATE "User" SET banned = true WHERE id = ${banned.id}`;
		const viewer = await createUser();
		const admin = await makeAdmin(await createUser());

		expect((await list(`search=${tag}`)).users).toEqual([]);
		expect((await list(`search=${tag}`, viewer.cookie)).users).toEqual([]);
		expect((await list(`search=${tag}`, admin.cookie)).users.map((u) => u.id)).toEqual([banned.id]);
	});

	test("search by email works only for admins", async () => {
		const player = await createUser({ name: `${marker()} Mail` });
		const emailPart = player.email.split("@")[0] ?? "";

		const anonymous = await list(`search=${emailPart}`);
		expect(anonymous.users.map((u) => u.id)).not.toContain(player.id);

		const viewer = await createUser();
		const signedIn = await list(`search=${emailPart}`, viewer.cookie);
		expect(signedIn.users.map((u) => u.id)).not.toContain(player.id);

		const admin = await makeAdmin(await createUser());
		const asAdmin = await list(`search=${emailPart}`, admin.cookie);
		expect(asAdmin.users.map((u) => u.id)).toContain(player.id);
	});

	test("clubs lists every active membership of public clubs, whatever the role", async () => {
		const tag = marker();
		const owner = await createUser({ name: `${tag} Owner` });
		const publicClub = await createClub(owner);
		const privateClub = await createClub(owner, { isPrivate: true });
		const archivedClub = await createClub(await createUser());
		const member = await createUser({ name: `${tag} Member` });
		await addMember(member.id, publicClub.id, "USER");
		await addMember(member.id, privateClub.id, "USER");
		await addMember(member.id, archivedClub.id, "USER", "ARCHIVED");

		const result = await list(`search=${tag}`);
		const byId = new Map(result.users.map((u) => [u.id, u]));
		const ownerRow = byId.get(owner.id);
		expect(ownerRow?.clubs.map((c) => c.id).sort()).toEqual([publicClub.id].sort());
		expect(ownerRow?.clubs[0]).toMatchObject({ id: publicClub.id, name: publicClub.name });
		expect(ownerRow?.clubs[0]).toHaveProperty("logo");
		// The old field keeps its meaning: plain-member rows only.
		expect(ownerRow?.clubMembership).toEqual([]);
		const memberRow = byId.get(member.id);
		expect(memberRow?.clubs.map((c) => c.id)).toEqual([publicClub.id]);
		expect(memberRow?.clubMembership.map((m) => m.club.id)).toEqual([publicClub.id]);
	});

	test("clubId, countryId and city filters match members of public clubs", async () => {
		const tag = marker();
		const owner = await createUser({ name: `${tag} Owner` });
		const clubIn = await createClub(owner);
		const outSlug = `zs-${crypto.randomUUID().slice(0, 8)}`;
		const clubOut = await createClub(await createUser(), { slug: outSlug });
		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0].id as number;
		const citySlug = `zcity-${crypto.randomUUID().slice(0, 8)}`;
		await testDb`UPDATE "Club" SET city = 'Zcity', "citySlug" = ${citySlug}, "countryId" = ${countryId} WHERE id = ${clubIn.id}`;
		await testDb`UPDATE "Club" SET "countryId" = NULL WHERE id = ${clubOut.id}`;
		const inPlayer = await createUser({ name: `${tag} In` });
		const outPlayer = await createUser({ name: `${tag} Out` });
		await addMember(inPlayer.id, clubIn.id);
		await addMember(outPlayer.id, clubOut.id);

		const byClub = await list(`search=${tag}&clubId=${clubIn.id}`);
		expect(byClub.users.map((u) => u.id).sort()).toEqual([owner.id, inPlayer.id].sort());
		const byOtherClub = await list(`search=${tag}&clubId=${outSlug}`);
		expect(byOtherClub.users.map((u) => u.id)).toContain(outPlayer.id);
		expect(byOtherClub.users.map((u) => u.id)).not.toContain(inPlayer.id);

		const byCity = await list(`search=${tag}&city=${citySlug}`);
		expect(byCity.users.map((u) => u.id).sort()).toEqual([owner.id, inPlayer.id].sort());
		const byCityName = await list(`search=${tag}&city=ZCITY`);
		expect(byCityName.pagination.total).toBe(2);

		const byCountry = await list(`search=${tag}&countryId=${countryId}`);
		expect(byCountry.users.map((u) => u.id)).toContain(inPlayer.id);
		expect(byCountry.users.map((u) => u.id)).not.toContain(outPlayer.id);
		expect(byCountry.pagination.total).toBe(byCountry.users.length);
	});

	test("sort=games ranks by finished games and sort=newest and sort=name order the rest", async () => {
		const tag = marker();
		const owner = await createUser({ name: `${tag} Owner` });
		const club = await createClub(owner);
		const veteran = await createUser({ name: `${tag} Bravo` });
		const rookie = await createUser({ name: `${tag} Alpha` });
		await playFinishedGame(owner, club.id, veteran);
		await playFinishedGame(owner, club.id, veteran);
		await playFinishedGame(owner, club.id, rookie);

		const byGames = await list(`search=${tag}&sort=games`);
		expect(byGames.users.map((u) => u.id).slice(0, 2)).toEqual([veteran.id, rookie.id]);
		expect(byGames.users.map((u) => u.gamesCount)).toEqual([2, 1, 0]);

		const byName = await list(`search=${tag}&sort=name`);
		expect(byName.users.map((u) => u.name)).toEqual([`${tag} Alpha`, `${tag} Bravo`, `${tag} Owner`]);

		const newest = await list(`search=${tag}&sort=newest`);
		expect(newest.users.map((u) => u.id)).toEqual([rookie.id, veteran.id, owner.id]);
	});

	test("an upcoming or not yet confirmed place is not a played game", async () => {
		const tag = marker();
		const owner = await createUser({ name: `${tag} Owner` });
		const club = await createClub(owner);
		const player = await createUser({ name: `${tag} Player` });
		const upcoming = await createEvent(owner, club.id);
		await register(player, upcoming.id);

		const finished = await playFinishedGame(owner, club.id, player);
		await testDb`UPDATE "EventAttendee" SET attended = false WHERE "eventId" = ${finished.id} AND "userId" = ${player.id}`;

		const result = await list(`search=${tag}`);
		expect(result.users.find((u) => u.id === player.id)?.gamesCount).toBe(0);
	});

	test("rating is the average of reviews received", async () => {
		const tag = marker();
		const target = await createUser({ name: `${tag} Target` });
		const reviewerA = await createUser();
		const reviewerB = await createUser();
		await addUserReview(reviewerA.id, target.id, 5);
		await addUserReview(reviewerB.id, target.id, 4);

		const result = await list(`search=${tag}`);
		expect(result.users[0]?.rating).toEqual({ average: 4.5, count: 2 });
		const unrated = await list(`search=${tag}Nope`);
		expect(unrated.users).toEqual([]);
	});

	test("private users are hidden and private stats hide games and rating", async () => {
		const tag = marker();
		const owner = await createUser({ name: `${tag} Owner` });
		const club = await createClub(owner);
		const stealthy = await createUser({ name: `${tag} Stealth` });
		const hidden = await createUser({ name: `${tag} Hidden` });
		const open = await createUser({ name: `${tag} Open` });
		await playFinishedGame(owner, club.id, stealthy);
		await playFinishedGame(owner, club.id, stealthy);
		await playFinishedGame(owner, club.id, open);
		await addUserReview(open.id, stealthy.id, 5);
		await testDb`UPDATE "User" SET "isPrivateStats" = true WHERE id = ${stealthy.id}`;
		await testDb`UPDATE "User" SET "isPrivate" = true WHERE id = ${hidden.id}`;

		const anonymous = await list(`search=${tag}&sort=games`);
		expect(anonymous.users.map((u) => u.id)).not.toContain(hidden.id);
		const stealthRow = anonymous.users.find((u) => u.id === stealthy.id);
		expect(stealthRow?.gamesCount).toBeNull();
		expect(stealthRow?.rating).toBeNull();
		// The hidden count must not leak through the order either: the 2-game player is not first.
		expect(anonymous.users[0]?.id).toBe(open.id);
		expect(anonymous.users[anonymous.users.length - 1]?.id).toBe(stealthy.id);

		const self = await list(`search=${tag}&sort=games`, stealthy.cookie);
		expect(self.users.find((u) => u.id === stealthy.id)?.gamesCount).toBe(2);
		expect(self.users[0]?.id).toBe(stealthy.id);
		expect(self.users.find((u) => u.id === stealthy.id)?.rating).toEqual({ average: 5, count: 1 });

		const admin = await makeAdmin(await createUser());
		const asAdmin = await list(`search=${tag}&sort=games`, admin.cookie);
		expect(asAdmin.users.find((u) => u.id === stealthy.id)?.gamesCount).toBe(2);
		expect(asAdmin.users.map((u) => u.id)).toContain(hidden.id);
	});
});
