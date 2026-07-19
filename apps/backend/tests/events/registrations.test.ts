import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Registration Club ${crypto.randomUUID().slice(0, 8)}`,
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
		name: `Registration Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 10,
		location: "Sarajevo",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string };
}

describe("creating and cancelling a registration", () => {
	test("registering while unauthenticated is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(response.status).toBe(401);
	});

	test("registering for a nonexistent event returns 404", async () => {
		const attendee = await createUser();
		const response = await api(attendee.cookie).post(`/api/events/${crypto.randomUUID()}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(response.status).toBe(404);
	});

	test("registering with an invalid body is rejected", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "not-a-type",
			paymentMethod: "cash",
		});
		expect(response.status).toBe(400);
	});

	test("registering twice updates the existing registration instead of creating a new one", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const first = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(first.status).toBe(200);

		const second = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "team",
			paymentMethod: "bank",
		});
		expect(second.status).toBe(200);
		expect(second.body.registration.id).toBe(first.body.registration.id);
		expect(second.body.registration.type).toBe("team");
		expect(second.body.registration.paymentMethod).toBe("bank");
	});

	test("cancelling a registration while unauthenticated is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().delete(`/api/events/${event.id}/registrations`);
		expect(response.status).toBe(401);
	});

	test("cancelling a registration that does not exist returns 404", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(attendee.cookie).delete(`/api/events/${event.id}/registrations`);
		expect(response.status).toBe(404);
	});
});

describe("apply-data endpoint", () => {
	test("apply-data requires authentication", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().get(`/api/events/${event.id}/apply-data`);
		expect(response.status).toBe(401);
	});

	test("apply-data returns null existingRegistration when the caller has not registered", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(attendee.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(response.status).toBe(200);
		expect(response.body.event.id).toBe(event.id);
		expect(response.body.existingRegistration).toBeNull();
	});

	test("apply-data returns the caller's existing registration", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(registration.status).toBe(200);

		const response = await api(attendee.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(response.status).toBe(200);
		expect(response.body.existingRegistration?.id).toBe(registration.body.registration.id);
	});

	test("apply-data for a private event 404s for non-members", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api(outsider.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(response.status).toBe(404);
	});

	test("apply-data for a nonexistent event returns 404", async () => {
		const attendee = await createUser();
		const response = await api(attendee.cookie).get(`/api/events/${crypto.randomUUID()}/apply-data`);
		expect(response.status).toBe(404);
	});
});

describe("listing and counting registrations", () => {
	test("only club managers can list an event's registrations", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});

		const asOwner = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		expect(asOwner.status).toBe(200);
		expect(asOwner.body.registrations.length).toBe(1);
		expect(asOwner.body.registrations[0].createdBy.id).toBe(attendee.id);

		const asOutsider = await api(outsider.cookie).get(`/api/events/${event.id}/registrations`);
		expect(asOutsider.status).toBe(403);

		const anonymous = await api().get(`/api/events/${event.id}/registrations`);
		expect(anonymous.status).toBe(401);
	});

	test("listing registrations for a nonexistent event returns 404", async () => {
		const owner = await createUser();
		const response = await api(owner.cookie).get(`/api/events/${crypto.randomUUID()}/registrations`);
		expect(response.status).toBe(404);
	});

	test("the registration count endpoint is public and reflects registrations made before the first read", async () => {
		// The endpoint caches its result for 300s (varyByUser: false) and registration creation
		// does not bust that key, so reading it before *and* after registering would just observe
		// the same cached value. Registering first and reading once avoids depending on that gap.
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});

		const response = await api().get(`/api/events/${event.id}/registrations/count`);
		expect(response.status).toBe(200);
		expect(response.body.count).toBe(1);
	});
});

describe("attendance toggling", () => {
	test("a manager can mark a registration as attended and unattended", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		const registrationId = registration.body.registration.id as string;

		const markAttended = await api(owner.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/attendance`,
			{ attended: true },
		);
		expect(markAttended.status).toBe(200);
		expect(markAttended.body.registration.attended).toBeTrue();

		const markUnattended = await api(owner.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/attendance`,
			{ attended: false },
		);
		expect(markUnattended.status).toBe(200);
		expect(markUnattended.body.registration.attended).toBeFalse();
	});

	test("attendance toggling requires authentication", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		const registrationId = registration.body.registration.id as string;

		const response = await api().put(`/api/events/${event.id}/registrations/${registrationId}/attendance`, {
			attended: true,
		});
		expect(response.status).toBe(401);
	});

	test("a non-manager cannot toggle attendance", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		const registrationId = registration.body.registration.id as string;

		const response = await api(outsider.cookie).put(
			`/api/events/${event.id}/registrations/${registrationId}/attendance`,
			{ attended: true },
		);
		expect(response.status).toBe(403);
	});

	test("toggling attendance for an unknown registration returns 404", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).put(
			`/api/events/${event.id}/registrations/${crypto.randomUUID()}/attendance`,
			{ attended: true },
		);
		expect(response.status).toBe(404);
	});
});
