import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

// The real Instagram/Facebook Graph API is not reachable from tests, so only the
// auth/authorization/not-connected/validation branches that don't need it are covered here.

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Instagram Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

describe("club instagram", () => {
	describe("GET /clubs/:id/instagram/auth-url", () => {
		test("a manager can get the Facebook authorization URL", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/instagram/auth-url`);
			expect(response.status).toBe(200);
			expect(response.body.authUrl).toBeString();
			expect(response.body.authUrl).toContain("facebook.com");
			expect(response.body.authUrl).toContain(`state=${club.id}`);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/instagram/auth-url`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/instagram/auth-url`);
			expect(response.status).toBe(403);
		});
	});

	describe("POST /clubs/:id/instagram/disconnect", () => {
		test("a manager can disconnect (no-op when never connected)", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/instagram/disconnect`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/instagram/disconnect`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/instagram/disconnect`);
			expect(response.status).toBe(403);
		});
	});

	describe("GET /clubs/:id/instagram/check-token", () => {
		test("reports not connected when the club has no Instagram token", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/instagram/check-token`);
			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				connected: false,
				igBusinessId: null,
				tokenType: null,
				expiresAt: null,
			});
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/instagram/check-token`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/instagram/check-token`);
			expect(response.status).toBe(403);
		});
	});

	describe("POST /clubs/:id/instagram/exchange-code", () => {
		// The happy path calls the real Facebook token-exchange API and can't be exercised here.
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/instagram/exchange-code`, { code: "abc" });
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/instagram/exchange-code`, {
				code: "abc",
			});
			expect(response.status).toBe(403);
		});
	});

	describe("GET /clubs/:id/instagram/page-selection", () => {
		test("400s for an invalid or expired session", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(
				`/api/clubs/${club.id}/instagram/page-selection?sessionId=${crypto.randomUUID()}`,
			);
			expect(response.status).toBe(400);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(
				`/api/clubs/${club.id}/instagram/page-selection?sessionId=${crypto.randomUUID()}`,
			);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(
				`/api/clubs/${club.id}/instagram/page-selection?sessionId=${crypto.randomUUID()}`,
			);
			expect(response.status).toBe(403);
		});
	});

	describe("POST /clubs/:id/instagram/select-page", () => {
		test("400s when neither an access token nor a session ID is provided", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/instagram/select-page`, {
				pageId: "page-123",
			});
			expect(response.status).toBe(400);
		});

		// The happy path calls the real Facebook Graph API and can't be exercised here.
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/instagram/select-page`, { pageId: "page-123" });
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/instagram/select-page`, {
				pageId: "page-123",
			});
			expect(response.status).toBe(403);
		});
	});

	describe("GET /clubs/:id/instagram/media", () => {
		test("returns an empty feed when the club isn't connected (no auth required)", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/instagram/media`);
			expect(response.status).toBe(200);
			expect(response.body).toEqual({ media: [], username: null });
		});

		test("404s for an unknown club", async () => {
			const response = await api().get(`/api/clubs/${crypto.randomUUID()}/instagram/media`);
			expect(response.status).toBe(404);
		});
	});
});
