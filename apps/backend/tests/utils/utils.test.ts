import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Search Test Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; slug: string | null };
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Search Test Event ${crypto.randomUUID().slice(0, 8)}`,
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

describe("search", () => {
	test("finds a club by name, anonymously, with pagination metadata", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api().get(`/api/search?search=${encodeURIComponent(club.name)}&filter=club`);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === club.id);
		expect(found).toBeDefined();
		expect(found.type).toBe("club");
		expect(response.body.pagination).toMatchObject({ page: 1, perPage: 25 });
	});

	test("finds a user by name, anonymously", async () => {
		const owner = await createUser();

		const response = await api().get(`/api/search?search=${encodeURIComponent(owner.name)}&filter=user`);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === owner.id);
		expect(found).toBeDefined();
		expect(found.type).toBe("user");
	});

	test("finds a public event by name, anonymously", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().get(`/api/search?search=${encodeURIComponent(event.name)}&filter=event`);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === event.id);
		expect(found).toBeDefined();
		expect(found.type).toBe("event");
	});

	test("excludes private events from anonymous search results", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api().get(`/api/search?search=${encodeURIComponent(event.name)}&filter=event`);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === event.id);
		expect(found).toBeUndefined();
	});

	test("a private event is visible in search to a member of its club", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api(owner.cookie).get(
			`/api/search?search=${encodeURIComponent(event.name)}&filter=event`,
		);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === event.id);
		expect(found).toBeDefined();
	});

	test("excludes private clubs from search results", async () => {
		const owner = await createUser();
		const club = await createClub(owner, { isPrivate: true });

		const response = await api().get(`/api/search?search=${encodeURIComponent(club.name)}&filter=club`);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === club.id);
		expect(found).toBeUndefined();
	});

	test("filter param restricts result types", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api().get(`/api/search?search=${encodeURIComponent(club.name)}&filter=user`);
		expect(response.status).toBe(200);
		const found = response.body.items.find((item: { id: string }) => item.id === club.id);
		expect(found).toBeUndefined();
	});

	test("rejects an invalid page value with 400", async () => {
		const response = await api().get("/api/search?page=0");
		expect(response.status).toBe(400);
	});

	test("rejects a perPage above the maximum with 400", async () => {
		const response = await api().get("/api/search?perPage=1000");
		expect(response.status).toBe(400);
	});

	test("returns an empty items list for a search term matching nothing", async () => {
		const response = await api().get(
			`/api/search?search=${encodeURIComponent(`no-such-thing-${crypto.randomUUID()}`)}`,
		);
		expect(response.status).toBe(200);
		expect(response.body.items).toEqual([]);
		expect(response.body.pagination.total).toBe(0);
	});
});

describe("validate-slug", () => {
	test("an unused club slug is available", async () => {
		const response = await api().post("/api/validate-slug", {
			type: "club",
			slug: `unused-slug-${crypto.randomUUID()}`,
		});
		expect(response.status).toBe(200);
		expect(response.body.available).toBeTrue();
	});

	test("a taken club slug is unavailable", async () => {
		const owner = await createUser();
		const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
		await createClub(owner, { slug });

		const response = await api().post("/api/validate-slug", { type: "club", slug });
		expect(response.status).toBe(200);
		expect(response.body.available).toBeFalse();
	});

	test("a taken slug is available again when excluded via excludeId", async () => {
		const owner = await createUser();
		const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
		const club = await createClub(owner, { slug });

		const response = await api().post("/api/validate-slug", {
			type: "club",
			slug,
			excludeId: club.id,
		});
		expect(response.status).toBe(200);
		expect(response.body.available).toBeTrue();
	});

	test("an unused event slug is available", async () => {
		const response = await api().post("/api/validate-slug", {
			type: "event",
			slug: `unused-event-slug-${crypto.randomUUID()}`,
		});
		expect(response.status).toBe(200);
		expect(response.body.available).toBeTrue();
	});

	test("an unused user slug is available", async () => {
		const response = await api().post("/api/validate-slug", {
			type: "user",
			slug: `unused-user-slug-${crypto.randomUUID()}`,
		});
		expect(response.status).toBe(200);
		expect(response.body.available).toBeTrue();
	});

	test("rejects an invalid type with 400", async () => {
		const response = await api().post("/api/validate-slug", {
			type: "invalid-type",
			slug: "whatever",
		});
		expect(response.status).toBe(400);
	});

	test("rejects an empty slug with 400", async () => {
		const response = await api().post("/api/validate-slug", { type: "club", slug: "" });
		expect(response.status).toBe(400);
	});

	test("rejects a missing type with 400", async () => {
		const response = await api().post("/api/validate-slug", { slug: "no-type-here" });
		expect(response.status).toBe(400);
	});
});

describe("sitemap", () => {
	test("includes a freshly created public club, event, and user", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().get("/api/sitemap");
		expect(response.status).toBe(200);

		const clubIds = response.body.clubs.map((c: { id: string }) => c.id);
		const eventIds = response.body.events.map((e: { id: string }) => e.id);
		const userIds = response.body.users.map((u: { id: string }) => u.id);

		expect(clubIds).toContain(club.id);
		expect(eventIds).toContain(event.id);
		expect(userIds).toContain(owner.id);
	});

	test("excludes private clubs, events, and users", async () => {
		const owner = await createUser({ name: "Private Sitemap User" });
		const club = await createClub(owner, { isPrivate: true });
		const event = await createEvent(owner, club.id, { isPrivate: true });
		const privacyUpdate = await api(owner.cookie).put(`/api/users/${owner.id}`, { isPrivate: true });
		expect(privacyUpdate.status).toBe(200);

		const response = await api().get("/api/sitemap");
		expect(response.status).toBe(200);

		const clubIds = response.body.clubs.map((c: { id: string }) => c.id);
		const eventIds = response.body.events.map((e: { id: string }) => e.id);
		const userIds = response.body.users.map((u: { id: string }) => u.id);

		expect(clubIds).not.toContain(club.id);
		expect(eventIds).not.toContain(event.id);
		expect(userIds).not.toContain(owner.id);
	});
});

describe("health", () => {
	test("reports healthy database and redis connections", async () => {
		const response = await api().get("/api/health");
		expect(response.status).toBe(200);
		expect(response.body.status).toBe("healthy");
		expect(response.body.database).toBe("connected");
		expect(response.body.redis).toBe("connected");
		expect(response.body.databaseLatency).toMatch(/^\d+ms$/);
		expect(response.body.redisLatency).toMatch(/^\d+ms$/);
	});
});
