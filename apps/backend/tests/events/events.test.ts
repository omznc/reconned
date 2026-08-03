import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Event Club ${crypto.randomUUID().slice(0, 8)}`,
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
		name: `Test Event ${crypto.randomUUID().slice(0, 8)}`,
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

describe("events", () => {
	test("only club managers can create events for a club", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);

		await createEvent(owner, club.id);

		const now = Date.now();
		const denied = await api(outsider.cookie).post("/api/events", {
			clubId: club.id,
			name: "Not My Club Event",
			description: "Should be rejected",
			costPerPerson: 0,
			location: "Sarajevo",
			dateStart: new Date(now + 7 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		});
		expect(denied.status).toBe(403);
	});

	test("a user can register for an open event and cancel the registration", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(registration.status).toBe(200);
		expect(registration.body.registration.eventId).toBe(event.id);

		const cancellation = await api(attendee.cookie).delete(`/api/events/${event.id}/registrations`);
		expect(cancellation.status).toBe(200);

		const cancelAgain = await api(attendee.cookie).delete(`/api/events/${event.id}/registrations`);
		expect(cancelAgain.status).toBe(404);
	});

	test("registration is rejected before registrations open and after they close", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const now = Date.now();

		const notOpenYet = await createEvent(owner, club.id, {
			dateRegistrationsOpen: new Date(now + DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		});
		const tooEarly = await api(attendee.cookie).post(`/api/events/${notOpenYet.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(tooEarly.status).toBe(400);

		const alreadyClosed = await createEvent(owner, club.id, {
			dateRegistrationsOpen: new Date(now - 2 * DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now - DAY_MS).toISOString(),
		});
		const tooLate = await api(attendee.cookie).post(`/api/events/${alreadyClosed.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(tooLate.status).toBe(400);
	});

	test("the events list returns items with pagination metadata", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const list = await api(owner.cookie).get(`/api/events?search=${encodeURIComponent(event.name)}`);
		expect(list.status).toBe(200);
		expect(list.body.events.map((e: { id: string }) => e.id)).toContain(event.id);
		expect(list.body.pagination).toMatchObject({ page: 1 });
	});
});
