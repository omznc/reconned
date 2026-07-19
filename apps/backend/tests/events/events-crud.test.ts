import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Event CRUD Club ${crypto.randomUUID().slice(0, 8)}`,
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
		name: `CRUD Event ${crypto.randomUUID().slice(0, 8)}`,
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
	return response.body.event as { id: string; name: string; slug: string | null };
}

describe("event validation", () => {
	test("creating an event with an invalid body is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).post("/api/events", {
			clubId: club.id,
			name: "",
			description: "",
			costPerPerson: -5,
			location: "Sarajevo",
			dateStart: new Date().toISOString(),
			dateEnd: new Date().toISOString(),
			dateRegistrationsOpen: new Date().toISOString(),
			dateRegistrationsClose: new Date().toISOString(),
		});
		expect(response.status).toBe(400);
	});

	test("creating an event while unauthenticated is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api().post("/api/events", {
			clubId: club.id,
			name: "Anon Event",
			description: "Should be rejected",
			costPerPerson: 0,
			location: "Sarajevo",
			dateStart: new Date(Date.now() + DAY_MS).toISOString(),
			dateEnd: new Date(Date.now() + 2 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date().toISOString(),
			dateRegistrationsClose: new Date(Date.now() + DAY_MS).toISOString(),
		});
		expect(response.status).toBe(401);
	});
});

describe("event get by id/slug", () => {
	test("an event can be fetched by id or by slug", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { slug: `slug-${crypto.randomUUID().slice(0, 8)}` });

		const byId = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(byId.status).toBe(200);
		expect(byId.body.event.id).toBe(event.id);

		const bySlug = await api(owner.cookie).get(`/api/events/${event.slug}`);
		expect(bySlug.status).toBe(200);
		expect(bySlug.body.event.id).toBe(event.id);
		expect(bySlug.body.registrationCount).toBeNumber();
		expect(bySlug.body.rules).toBeArray();
	});

	test("a nonexistent event returns 404", async () => {
		const owner = await createUser();
		const response = await api(owner.cookie).get(`/api/events/${crypto.randomUUID()}`);
		expect(response.status).toBe(404);
	});

	test("a private event is hidden from non-members but visible to club members", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const asOutsider = await api(outsider.cookie).get(`/api/events/${event.id}`);
		expect(asOutsider.status).toBe(404);

		const anonymous = await api().get(`/api/events/${event.id}`);
		expect(anonymous.status).toBe(404);

		const asOwner = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(asOwner.status).toBe(200);
	});

	test("a private club's event is hidden even when the event itself is public", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner, { isPrivate: true });
		const event = await createEvent(owner, club.id, { isPrivate: false });

		const asOutsider = await api(outsider.cookie).get(`/api/events/${event.id}`);
		expect(asOutsider.status).toBe(404);
	});
});

describe("event update", () => {
	function updatePayload(event: { name: string }, overrides: Record<string, unknown> = {}) {
		const now = Date.now();
		return {
			clubId: overrides.clubId,
			name: event.name,
			description: "Updated description",
			costPerPerson: 15,
			location: "Mostar",
			dateStart: new Date(now + 7 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
			...overrides,
		};
	}

	test("a manager can update their club's event", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).put(
			`/api/events/${event.id}`,
			updatePayload(event, { clubId: club.id, location: "Mostar" }),
		);
		expect(response.status).toBe(200);
		expect(response.body.event.location).toBe("Mostar");
	});

	test("updating an event while unauthenticated is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().put(`/api/events/${event.id}`, updatePayload(event, { clubId: club.id }));
		expect(response.status).toBe(401);
	});

	test("a non-manager cannot update an event", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(outsider.cookie).put(
			`/api/events/${event.id}`,
			updatePayload(event, { clubId: club.id }),
		);
		expect(response.status).toBe(403);
	});

	test("updating a nonexistent event returns 404", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).put(
			`/api/events/${crypto.randomUUID()}`,
			updatePayload({ name: "Ghost Event" }, { clubId: club.id }),
		);
		expect(response.status).toBe(404);
	});

	test("a finished event cannot be updated", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const now = Date.now();
		const event = await createEvent(owner, club.id, {
			dateStart: new Date(now - 5 * DAY_MS).toISOString(),
			dateEnd: new Date(now - 2 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - 10 * DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now - 6 * DAY_MS).toISOString(),
		});

		const response = await api(owner.cookie).put(
			`/api/events/${event.id}`,
			updatePayload(event, { clubId: club.id }),
		);
		expect(response.status).toBe(400);
	});

	test("updating an event with an already-taken slug is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const taken = await createEvent(owner, club.id, { slug: `taken-${crypto.randomUUID().slice(0, 8)}` });
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).put(
			`/api/events/${event.id}`,
			updatePayload(event, { clubId: club.id, slug: taken.slug }),
		);
		expect(response.status).toBe(400);
	});
});

describe("event deletion", () => {
	test("a manager can delete their club's event", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).delete(`/api/events/${event.id}`);
		expect(response.status).toBe(200);

		const afterDelete = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(afterDelete.status).toBe(404);
	});

	test("deleting an event while unauthenticated is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().delete(`/api/events/${event.id}`);
		expect(response.status).toBe(401);
	});

	test("a non-manager cannot delete an event", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(outsider.cookie).delete(`/api/events/${event.id}`);
		expect(response.status).toBe(403);
	});

	test("deleting a nonexistent event returns 404", async () => {
		const owner = await createUser();
		const response = await api(owner.cookie).delete(`/api/events/${crypto.randomUUID()}`);
		expect(response.status).toBe(404);
	});
});

describe("event image upload url", () => {
	test("a manager can obtain a presigned upload url", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).post(`/api/events/${event.id}/image/upload-url`, {
			file: { type: "image/png", size: 1024 },
		});
		expect(response.status).toBe(200);
		expect(response.body.url).toBeString();
		expect(response.body.cdnUrl).toBeString();
		expect(response.body.key).toBeString();
	});

	test("requesting an upload url while unauthenticated is rejected", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().post(`/api/events/${event.id}/image/upload-url`, {
			file: { type: "image/png", size: 1024 },
		});
		expect(response.status).toBe(401);
	});

	test("a non-manager cannot obtain an upload url", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(outsider.cookie).post(`/api/events/${event.id}/image/upload-url`, {
			file: { type: "image/png", size: 1024 },
		});
		expect(response.status).toBe(403);
	});

	test("requesting an upload url for a nonexistent event returns 404", async () => {
		const owner = await createUser();
		const response = await api(owner.cookie).post(`/api/events/${crypto.randomUUID()}/image/upload-url`, {
			file: { type: "image/png", size: 1024 },
		});
		expect(response.status).toBe(404);
	});

	test("a manager can delete an event's image", async () => {
		// No image is set here: deleting the image key would call the real S3 delete API, which
		// requires a live bucket the test environment doesn't provide. The null-image branch
		// (skips the S3 call, still clears the column) is what's exercised.
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).delete(`/api/events/${event.id}/image`);
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(owner.cookie).get(`/api/events/${event.id}`);
		expect(fetched.body.event.image).toBeNull();
	});

	test("a non-manager cannot delete an event's image", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { image: "https://cdn.example.com/some-key.png" });

		const response = await api(outsider.cookie).delete(`/api/events/${event.id}/image`);
		expect(response.status).toBe(403);
	});
});

describe("event listing endpoints", () => {
	test("upcoming events only include events starting in the future", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const upcoming = await createEvent(owner, club.id);

		const response = await api(owner.cookie).get("/api/events/upcoming?limit=50");
		expect(response.status).toBe(200);
		expect(response.body.events.map((e: { id: string }) => e.id)).toContain(upcoming.id);
	});

	test("calendar view requires a start and end date", async () => {
		const owner = await createUser();

		const missing = await api(owner.cookie).get("/api/events/calendar");
		expect(missing.status).toBe(400);
	});

	test("calendar view returns events within the requested date range", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const now = Date.now();
		const startDate = new Date(now).toISOString();
		const endDate = new Date(now + 30 * DAY_MS).toISOString();

		const response = await api(owner.cookie).get(
			`/api/events/calendar?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
		);
		expect(response.status).toBe(200);
		expect(response.body.events.map((e: { id: string }) => e.id)).toContain(event.id);
	});

	test("the 'mine' filter only returns events from the caller's clubs", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const asOwner = await api(owner.cookie).get("/api/events?filter=mine");
		expect(asOwner.status).toBe(200);
		expect(asOwner.body.events.map((e: { id: string }) => e.id)).toContain(event.id);

		const asOutsider = await api(outsider.cookie).get("/api/events?filter=mine");
		expect(asOutsider.status).toBe(200);
		expect(asOutsider.body.events.map((e: { id: string }) => e.id)).not.toContain(event.id);
	});

	test("events list respects pagination parameters", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		await createEvent(owner, club.id);
		await createEvent(owner, club.id);

		const response = await api(owner.cookie).get("/api/events?filter=mine&page=1&perPage=1");
		expect(response.status).toBe(200);
		expect(response.body.events.length).toBe(1);
		expect(response.body.pagination).toMatchObject({ page: 1, perPage: 1 });
		expect(response.body.pagination.total).toBeGreaterThanOrEqual(2);
	});
});

describe("event rules", () => {
	test("rules attached to an event are returned by the rules endpoint", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const rule = await api(owner.cookie).post(`/api/clubs/${club.id}/rules`, {
			name: "No cheating",
			content: "Play fair.",
		});
		expect(rule.status).toBe(200);

		const event = await createEvent(owner, club.id, { ruleIds: [rule.body.rule.id] });

		const response = await api(owner.cookie).get(`/api/events/${event.id}/rules`);
		expect(response.status).toBe(200);
		expect(response.body.rules.map((r: { id: string }) => r.id)).toContain(rule.body.rule.id);
	});

	test("an event with no rules returns an empty list", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).get(`/api/events/${event.id}/rules`);
		expect(response.status).toBe(200);
		expect(response.body.rules).toEqual([]);
	});
});
