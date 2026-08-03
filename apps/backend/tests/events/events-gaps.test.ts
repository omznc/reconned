import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Events Gaps Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Events Gaps Event ${crypto.randomUUID().slice(0, 8)}`,
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
	return response.body.event as { id: string; clubId: string };
}

describe("GET /events visibility branches", () => {
	test("anonymous callers only see public events in public clubs", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		await createEvent(owner, club.id);

		const response = await api().get("/api/events?perPage=50");
		expect(response.status).toBe(200);
		expect(Array.isArray(response.body.events)).toBeTrue();
	});

	test("authenticated caller with no club memberships only sees public events", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);
		const outsider = await createUser();

		const response = await api(outsider.cookie).get("/api/events?perPage=50");
		expect(response.status).toBe(200);
		const found = response.body.events.find((e: { id: string }) => e.id === event.id);
		expect(found).toBeDefined();
	});

	test("authenticated caller with a club membership sees that club's private events too", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateEvent = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api(owner.cookie).get("/api/events?perPage=50");
		expect(response.status).toBe(200);
		const found = response.body.events.find((e: { id: string }) => e.id === privateEvent.id);
		expect(found).toBeDefined();
	});

	test("filter=mine with no memberships returns an empty result", async () => {
		const user = await createUser();
		const response = await api(user.cookie).get("/api/events?filter=mine");
		expect(response.status).toBe(200);
		expect(response.body.events).toEqual([]);
		expect(response.body.pagination.total).toBe(0);
	});

	test("filter=mine with a membership returns that club's events", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const clubEvent = await createEvent(owner, club.id);

		const response = await api(owner.cookie).get("/api/events?filter=mine");
		expect(response.status).toBe(200);
		const found = response.body.events.find((e: { id: string }) => e.id === clubEvent.id);
		expect(found).toBeDefined();
	});

	test("isPrivate query filter narrows results to private events", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateEvent = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api(owner.cookie).get("/api/events?isPrivate=true&perPage=50");
		expect(response.status).toBe(200);
		const found = response.body.events.find((e: { id: string }) => e.id === privateEvent.id);
		expect(found).toBeDefined();
		for (const e of response.body.events as Array<{ isPrivate: boolean }>) {
			expect(e.isPrivate).toBeTrue();
		}
	});

	test("search filters by event name", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const uniqueName = `Searchable ${crypto.randomUUID().slice(0, 8)}`;
		const searchEvent = await createEvent(owner, club.id, { name: uniqueName });

		const response = await api().get(`/api/events?search=${encodeURIComponent(uniqueName)}`);
		expect(response.status).toBe(200);
		expect(response.body.events.length).toBe(1);
		expect(response.body.events[0].id).toBe(searchEvent.id);
	});
});

describe("GET /events/calendar visibility branches", () => {
	function calendarRange() {
		const now = Date.now();
		const startDate = new Date(now - DAY_MS).toISOString();
		const endDate = new Date(now + 30 * DAY_MS).toISOString();
		return `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
	}

	test("missing startDate/endDate is rejected", async () => {
		const response = await api().get("/api/events/calendar");
		expect(response.status).toBe(400);
	});

	test("anonymous callers only see public events", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		await createEvent(owner, club.id);

		const response = await api().get(`/api/events/calendar?${calendarRange()}`);
		expect(response.status).toBe(200);
	});

	test("member sees their club's private events on the calendar", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const privateEvent = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api(owner.cookie).get(`/api/events/calendar?${calendarRange()}`);
		expect(response.status).toBe(200);
		const found = response.body.events?.find((e: { id: string }) => e.id === privateEvent.id);
		expect(found).toBeDefined();
	});
});

describe("POST /events validation branches", () => {
	test("rejects a slug that is already taken", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const slug = `taken-slug-${crypto.randomUUID().slice(0, 8)}`;
		await createEvent(owner, club.id, { slug });

		const now = Date.now();
		const response = await api(owner.cookie).post("/api/events", {
			clubId: club.id,
			name: "Duplicate Slug Event",
			description: "desc",
			costPerPerson: 10,
			location: "Sarajevo",
			dateStart: new Date(now + 7 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
			slug,
		});
		expect(response.status).toBe(400);
	});

	test("assigns club rules to the event via ruleIds", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const rule = await api(owner.cookie).post(`/api/clubs/${club.id}/rules`, {
			name: "No smoking",
			description: "Smoking is not allowed on premises",
			content: "No smoking is allowed anywhere on the range.",
		});
		expect(rule.status).toBe(200);
		const ruleId = rule.body.rule.id as string;

		const event = await createEvent(owner, club.id, { ruleIds: [ruleId] });

		const rulesResponse = await api(owner.cookie).get(`/api/events/${event.id}/rules`);
		expect(rulesResponse.status).toBe(200);
		expect(rulesResponse.body.rules.some((r: { id: string }) => r.id === ruleId)).toBeTrue();
	});
});

describe("PUT /events/:id ruleIds branch", () => {
	test("updates event rule assignments", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const rule = await api(owner.cookie).post(`/api/clubs/${club.id}/rules`, {
			name: "Eye protection required",
			description: "Must wear eye protection at all times",
			content: "Eye protection is mandatory for all participants.",
		});
		expect(rule.status).toBe(200);
		const ruleId = rule.body.rule.id as string;

		const now = Date.now();
		const update = await api(owner.cookie).put(`/api/events/${event.id}`, {
			clubId: club.id,
			name: "Updated Event Name",
			description: "An updated description",
			costPerPerson: 15,
			location: "Sarajevo",
			dateStart: new Date(now + 7 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
			ruleIds: [ruleId],
		});
		expect(update.status).toBe(200);

		const rulesResponse = await api(owner.cookie).get(`/api/events/${event.id}/rules`);
		expect(rulesResponse.status).toBe(200);
		expect(rulesResponse.body.rules.some((r: { id: string }) => r.id === ruleId)).toBeTrue();
	});
});

describe("DELETE /events/:id and /events/:id/image without an S3 image", () => {
	test("deletes an event that has no image set", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).delete(`/api/events/${event.id}`);
		expect(response.status).toBe(200);

		const getResponse = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(getResponse.status).toBe(404);
	});

	test("clears an event's image field when none is set", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).delete(`/api/events/${event.id}/image`);
		expect(response.status).toBe(200);
	});
});

describe("POST /events/:id/registrations with invites", () => {
	test("creating a registration with invitedUserIds and invitedUsersNotOnApp", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const invitedOnApp = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "team",
			paymentMethod: "cash",
			invitedUserIds: [invitedOnApp.id],
			invitedUsersNotOnApp: [
				{ name: "External Guest", email: `guest-${crypto.randomUUID().slice(0, 8)}@example.com` },
			],
		});
		expect(response.status).toBe(200);

		const listing = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		expect(listing.status).toBe(200);
		const reg = listing.body.registrations.find((r: { id: string }) => r.id === response.body.registration.id);
		expect(reg).toBeDefined();
		expect(reg.invitedUsers.length).toBe(1);
		expect(reg.invitedUsers[0].id).toBe(invitedOnApp.id);
		expect(reg.invitedUsersNotOnApp.length).toBe(1);
		expect(reg.createdBy.id).toBe(attendee.id);
	});

	test("updating a registration replaces invitedUserIds and invitedUsersNotOnApp", async () => {
		const owner = await createUser();
		const attendee = await createUser();
		const invitedOnApp1 = await createUser();
		const invitedOnApp2 = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const first = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "team",
			paymentMethod: "cash",
			invitedUserIds: [invitedOnApp1.id],
		});
		expect(first.status).toBe(200);

		const second = await api(attendee.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "team",
			paymentMethod: "bank",
			invitedUserIds: [invitedOnApp2.id],
			invitedUsersNotOnApp: [
				{ name: "Updated Guest", email: `guest2-${crypto.randomUUID().slice(0, 8)}@example.com` },
			],
		});
		expect(second.status).toBe(200);
		expect(second.body.registration.id).toBe(first.body.registration.id);

		const applyData = await api(attendee.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(applyData.status).toBe(200);
		expect(applyData.body.existingRegistration.invitedUsers.length).toBe(1);
		expect(applyData.body.existingRegistration.invitedUsers[0].id).toBe(invitedOnApp2.id);
		expect(applyData.body.existingRegistration.invitedUsersNotOnApp.length).toBe(1);
	});
});

describe("GET /events/:id/apply-data for private events and existing registrations", () => {
	test("a club member can fetch apply-data for a private event", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api(owner.cookie).get(`/api/events/${event.id}/apply-data`);
		expect(response.status).toBe(200);
		expect(response.body.event.id).toBe(event.id);
	});
});

describe("GET /events/:id/registrations formatting with real data", () => {
	test("returns an empty list when there are no registrations", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).get(`/api/events/${event.id}/registrations`);
		expect(response.status).toBe(200);
		expect(response.body.registrations).toEqual([]);
	});
});

describe("DELETE /events/:id/registrations and PUT attendance for nonexistent events", () => {
	test("cancelling a registration for a nonexistent event returns 404", async () => {
		const user = await createUser();
		const response = await api(user.cookie).delete(`/api/events/${crypto.randomUUID()}/registrations`);
		expect(response.status).toBe(404);
	});

	test("toggling attendance for a nonexistent event returns 404", async () => {
		const user = await createUser();
		const response = await api(user.cookie).put(
			`/api/events/${crypto.randomUUID()}/registrations/${crypto.randomUUID()}/attendance`,
			{ attended: true },
		);
		expect(response.status).toBe(404);
	});
});
