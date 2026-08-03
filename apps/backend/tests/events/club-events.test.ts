import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Club Events Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Club List Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 10,
		location: "Sarajevo",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		// The suite's attendees belong to no club; without this they hit the freelancer gate.
		allowFreelancers: true,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string; name: string };
}

describe("club events list", () => {
	test("the club events list is public and includes only public events for non-members", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const publicEvent = await createEvent(owner, club.id, { isPrivate: false });
		const privateEvent = await createEvent(owner, club.id, { isPrivate: true });

		const asAnonymous = await api().get(`/api/clubs/${club.id}/events`);
		expect(asAnonymous.status).toBe(200);
		const anonymousIds = asAnonymous.body.events.map((e: { id: string }) => e.id);
		expect(anonymousIds).toContain(publicEvent.id);
		expect(anonymousIds).not.toContain(privateEvent.id);

		const asOutsider = await api(outsider.cookie).get(`/api/clubs/${club.id}/events`);
		expect(asOutsider.status).toBe(200);
		const outsiderIds = asOutsider.body.events.map((e: { id: string }) => e.id);
		expect(outsiderIds).not.toContain(privateEvent.id);
	});

	test("club managers see private events in the club events list", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateEvent = await createEvent(owner, club.id, { isPrivate: true });

		const asOwner = await api(owner.cookie).get(`/api/clubs/${club.id}/events`);
		expect(asOwner.status).toBe(200);
		expect(asOwner.body.events.map((e: { id: string }) => e.id)).toContain(privateEvent.id);
	});

	test("the club events list includes registration counts", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});

		const response = await api(owner.cookie).get(`/api/clubs/${club.id}/events`);
		expect(response.status).toBe(200);
		const found = response.body.events.find((e: { id: string }) => e.id === event.id);
		expect(found._count.eventRegistration).toBe(1);
	});

	test("the club events list supports search and pagination", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const searched = await api(owner.cookie).get(
			`/api/clubs/${club.id}/events?search=${encodeURIComponent(event.name)}`,
		);
		expect(searched.status).toBe(200);
		expect(searched.body.events.map((e: { id: string }) => e.id)).toContain(event.id);

		const notFound = await api(owner.cookie).get(`/api/clubs/${club.id}/events?search=zzz-does-not-exist-zzz`);
		expect(notFound.status).toBe(200);
		expect(notFound.body.events.map((e: { id: string }) => e.id)).not.toContain(event.id);

		const paginated = await api(owner.cookie).get(`/api/clubs/${club.id}/events?page=1&perPage=1`);
		expect(paginated.status).toBe(200);
		expect(paginated.body.pagination).toMatchObject({ page: 1, perPage: 1 });
	});

	test("an invalid pagination query is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).get(`/api/clubs/${club.id}/events?perPage=0`);
		expect(response.status).toBe(400);
	});
});

describe("club events count", () => {
	test("the count reflects the same visibility rules as the list", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		await createEvent(owner, club.id, { isPrivate: false });
		await createEvent(owner, club.id, { isPrivate: true });

		const asOwner = await api(owner.cookie).get(`/api/clubs/${club.id}/events/count`);
		expect(asOwner.status).toBe(200);
		expect(asOwner.body.count).toBeGreaterThanOrEqual(2);

		const asOutsider = await api(outsider.cookie).get(`/api/clubs/${club.id}/events/count`);
		expect(asOutsider.status).toBe(200);
		expect(asOutsider.body.count).toBeLessThan(asOwner.body.count);
	});

	test("the count endpoint supports search filtering", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const matching = await api(owner.cookie).get(
			`/api/clubs/${club.id}/events/count?search=${encodeURIComponent(event.name)}`,
		);
		expect(matching.status).toBe(200);
		expect(matching.body.count).toBeGreaterThanOrEqual(1);

		const nonMatching = await api(owner.cookie).get(
			`/api/clubs/${club.id}/events/count?search=zzz-does-not-exist-zzz`,
		);
		expect(nonMatching.status).toBe(200);
		expect(nonMatching.body.count).toBe(0);
	});
});
