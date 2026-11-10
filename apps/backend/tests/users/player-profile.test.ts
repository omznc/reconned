import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, testDb } from "../helpers/auth";
import { api } from "../helpers/client";
import { addMember, addUserReview, createClub, createEvent, playFinishedGame, register } from "../helpers/people";

describe("GET /users/:id/profile", () => {
	test("returns member since, games played and rating", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const player = await createUser();
		await playFinishedGame(owner, club.id, player);
		await addUserReview(owner.id, player.id, 4);

		const response = await api().get(`/api/users/${player.id}/profile`);
		expect(response.status).toBe(200);
		expect(response.body.createdAt).toBeString();
		expect(Number.isNaN(Date.parse(`${response.body.createdAt.replace(" ", "T")}Z`))).toBe(false);
		expect(response.body.gamesCount).toBe(1);
		expect(response.body.rating).toEqual({ average: 4, count: 1 });
		expect(response.body.email).toBeNull();
	});

	test("a player without games or reviews has zero games and no rating", async () => {
		const player = await createUser();
		const response = await api().get(`/api/users/${player.id}/profile`);
		expect(response.body.gamesCount).toBe(0);
		expect(response.body.rating).toBeNull();
	});

	test("registered events carry the club name, place and price", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const player = await createUser();
		const event = await createEvent(owner, club.id, { costPerPerson: 30, location: "Sarajevo, Igman" });
		await register(player, event.id);

		const response = await api().get(`/api/users/${player.id}/profile`);
		const registration = response.body.eventRegistration.find((r: { eventId: string }) => r.eventId === event.id);
		expect(registration.event.location).toBe("Sarajevo, Igman");
		expect(registration.event.costPerPerson).toBe(30);
		expect(registration.event.club).toMatchObject({ id: club.id, name: club.name, isPrivate: false });
	});

	test("isPrivateStats no longer leaks registrations, games or rating", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const player = await createUser();
		await playFinishedGame(owner, club.id, player);
		await addUserReview(owner.id, player.id, 5);
		await testDb`UPDATE "User" SET "isPrivateStats" = true WHERE id = ${player.id}`;

		const anonymous = await api().get(`/api/users/${player.id}/profile`);
		expect(anonymous.status).toBe(200);
		expect(anonymous.body.eventRegistration).toEqual([]);
		expect(anonymous.body.gamesCount).toBeNull();
		expect(anonymous.body.rating).toBeNull();

		const stranger = await createUser();
		const other = await api(stranger.cookie).get(`/api/users/${player.id}/profile`);
		expect(other.body.eventRegistration).toEqual([]);
		expect(other.body.gamesCount).toBeNull();

		const self = await api(player.cookie).get(`/api/users/${player.id}/profile`);
		expect(self.body.eventRegistration.length).toBe(1);
		expect(self.body.gamesCount).toBe(1);
		expect(self.body.rating).toEqual({ average: 5, count: 1 });

		const admin = await makeAdmin(await createUser());
		const asAdmin = await api(admin.cookie).get(`/api/users/${player.id}/profile`);
		expect(asAdmin.body.gamesCount).toBe(1);
	});

	test("private events and private clubs never count as games", async () => {
		const owner = await createUser();
		const privateClub = await createClub(owner, { isPrivate: true });
		const publicClub = await createClub(owner);
		const player = await createUser();
		await addMember(player.id, privateClub.id);
		await playFinishedGame(owner, privateClub.id, player);
		const privateEvent = await playFinishedGame(owner, publicClub.id, player);
		await testDb`UPDATE "Event" SET "isPrivate" = true WHERE id = ${privateEvent.id}`;

		const response = await api().get(`/api/users/${player.id}/profile`);
		expect(response.body.gamesCount).toBe(0);
	});
});
