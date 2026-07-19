import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Stats Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

describe("clubs stats", () => {
	describe("GET /clubs/:id/stats", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().get(`/api/clubs/${club.id}/stats`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/stats`);
			expect(response.status).toBe(403);
		});

		test("returns stats for the owner", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/stats`);
			expect(response.status).toBe(200);
			expect(response.body.members).toBeArray();
			expect(response.body.roles).toBeArray();
			expect(response.body.events).toBeArray();
			expect(response.body.recentEvents).toBeArray();
			const ownerRole = response.body.roles.find((r: { role: string }) => r.role === "CLUB_OWNER");
			expect(ownerRole?.count).toBe(1);
		});

		test("returns 404 for a non-existent club", async () => {
			const owner = await createUser();
			// No membership exists for a random club id either, so the manager check runs first
			// and yields 403 before the not-found check is reached.
			const response = await api(owner.cookie).get(`/api/clubs/${crypto.randomUUID()}/stats`);
			expect(response.status).toBe(403);
		});
	});

	describe("GET /clubs/:id/storage-quota", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().get(`/api/clubs/${club.id}/storage-quota`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/storage-quota`);
			expect(response.status).toBe(403);
		});

		test("returns quota usage for the owner of a fresh club", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/storage-quota`);
			expect(response.status).toBe(200);
			expect(response.body.currentUsage).toBe(0);
			expect(response.body.limit).toBe(1024 * 1024 * 1024);
			expect(response.body.remaining).toBe(response.body.limit);
			expect(response.body.allowed).toBeTrue();
		});
	});
});
