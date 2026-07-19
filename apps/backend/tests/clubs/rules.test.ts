import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Rule Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function createRule(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const response = await api(owner.cookie).post(`/api/clubs/${clubId}/rules`, {
		name: `Rule ${crypto.randomUUID().slice(0, 8)}`,
		content: "No cheating",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.rule as { id: string; name: string; content: string };
}

describe("club rules", () => {
	describe("GET /clubs/:id/rules", () => {
		test("a manager can list rules", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/rules`);
			expect(response.status).toBe(200);
			expect(response.body.rules.map((r: { id: string }) => r.id)).toContain(rule.id);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/rules`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/rules`);
			expect(response.status).toBe(403);
		});
	});

	describe("GET /clubs/:id/rules/:ruleId", () => {
		test("a manager can fetch a specific rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(response.status).toBe(200);
			expect(response.body.rule.id).toBe(rule.id);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api().get(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(response.status).toBe(403);
		});

		test("404s for an unknown rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/rules/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});

	describe("POST /clubs/:id/rules", () => {
		test("a manager can create a rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/rules`, {
				name: "New Rule",
				description: "Optional description",
				content: "Be nice",
			});
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();
			expect(response.body.rule.name).toBe("New Rule");
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/rules`, {
				name: "New Rule",
				content: "Be nice",
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/rules`, {
				name: "New Rule",
				content: "Be nice",
			});
			expect(response.status).toBe(403);
		});

		test("rejects an empty name", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/rules`, {
				name: "",
				content: "Be nice",
			});
			expect(response.status).toBe(400);
		});
	});

	describe("PUT /clubs/:id/rules/:ruleId", () => {
		test("a manager can update a rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/rules/${rule.id}`, {
				name: "Updated Rule",
				content: "Updated content",
			});
			expect(response.status).toBe(200);
			expect(response.body.rule.name).toBe("Updated Rule");
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api().put(`/api/clubs/${club.id}/rules/${rule.id}`, {
				name: "Updated Rule",
				content: "Updated content",
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(outsider.cookie).put(`/api/clubs/${club.id}/rules/${rule.id}`, {
				name: "Updated Rule",
				content: "Updated content",
			});
			expect(response.status).toBe(403);
		});

		test("404s for an unknown rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/rules/${crypto.randomUUID()}`, {
				name: "Updated Rule",
				content: "Updated content",
			});
			expect(response.status).toBe(404);
		});
	});

	describe("DELETE /clubs/:id/rules/:ruleId", () => {
		test("a manager can delete a rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const fetchAfter = await api(owner.cookie).get(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(fetchAfter.status).toBe(404);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api().delete(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const rule = await createRule(owner, club.id);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}/rules/${rule.id}`);
			expect(response.status).toBe(403);
		});

		test("404s for an unknown rule", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/rules/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});
});
