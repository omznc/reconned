import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Public Test Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		latitude: 43.8563,
		longitude: 18.4131,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; slug: string | null };
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Public Test Event ${crypto.randomUUID().slice(0, 8)}`,
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

describe("public clubs map", () => {
	test("lists public clubs with coordinates, anonymously", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api().get("/api/public/clubs/map");
		expect(response.status).toBe(200);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).toContain(club.id);

		const found = response.body.clubs.find((c: { id: string }) => c.id === club.id);
		expect(found.latitude).toBeNumber();
		expect(found.longitude).toBeNumber();
	});

	test("excludes private clubs", async () => {
		const owner = await createUser();
		const club = await createClub(owner, { isPrivate: true });

		const response = await api().get("/api/public/clubs/map");
		expect(response.status).toBe(200);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).not.toContain(club.id);
	});

	test("excludes clubs without coordinates", async () => {
		const owner = await createUser();
		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0]?.id;
		const created = await api(owner.cookie).post("/api/clubs", {
			name: `Public Test Club No Coords ${crypto.randomUUID().slice(0, 8)}`,
			countryId,
			location: "Sarajevo",
		});
		expect(created.status).toBe(200);
		const club = created.body.club as { id: string };

		const response = await api().get("/api/public/clubs/map");
		expect(response.status).toBe(200);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).not.toContain(club.id);
	});
});

describe("public sitemap", () => {
	test("clubs sitemap includes a freshly created public club, anonymously", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api().get("/api/public/sitemap/clubs");
		expect(response.status).toBe(200);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).toContain(club.id);
	});

	test("clubs sitemap excludes private clubs", async () => {
		const owner = await createUser();
		const club = await createClub(owner, { isPrivate: true });

		const response = await api().get("/api/public/sitemap/clubs");
		expect(response.status).toBe(200);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).not.toContain(club.id);
	});

	test("events sitemap includes a freshly created public event on a public club, anonymously", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api().get("/api/public/sitemap/events");
		expect(response.status).toBe(200);
		const ids = response.body.events.map((e: { id: string }) => e.id);
		expect(ids).toContain(event.id);
	});

	test("events sitemap excludes private events", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id, { isPrivate: true });

		const response = await api().get("/api/public/sitemap/events");
		expect(response.status).toBe(200);
		const ids = response.body.events.map((e: { id: string }) => e.id);
		expect(ids).not.toContain(event.id);
	});

	test("users sitemap includes a freshly created public user, anonymously", async () => {
		const testUser = await createUser();

		const response = await api().get("/api/public/sitemap/users");
		expect(response.status).toBe(200);
		const ids = response.body.users.map((u: { id: string }) => u.id);
		expect(ids).toContain(testUser.id);
	});
});

describe("public stats", () => {
	test("returns aggregate counts, anonymously", async () => {
		const response = await api().get("/api/public/stats");
		expect(response.status).toBe(200);
		expect(response.body.stats.clubs).toBeNumber();
		expect(response.body.stats.events).toBeNumber();
		expect(response.body.stats.players).toBeNumber();
	});

	test("is cached: repeated calls return the same data", async () => {
		const first = await api().get("/api/public/stats");
		const second = await api().get("/api/public/stats");
		expect(first.status).toBe(200);
		expect(second.body).toEqual(first.body);
	});
});

describe("public feature flags", () => {
	test("returns only enabled feature flags, anonymously", async () => {
		const response = await api().get("/api/public/feature-flags");
		expect(response.status).toBe(200);
		expect(Array.isArray(response.body.featureFlags)).toBeTrue();
		for (const flag of response.body.featureFlags) {
			expect(flag.enabled).toBeTrue();
			expect(flag.name).toBeString();
		}
	});
});
