import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Audit Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

describe("clubs audit-logs", () => {
	test("requires authentication", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const response = await api().get(`/api/clubs/${club.id}/audit-logs`);
		expect(response.status).toBe(401);
	});

	test("forbids non-managers", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);

		const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/audit-logs`);
		expect(response.status).toBe(403);
	});

	test("returns the club-creation log entry for the owner, with pagination", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).get(`/api/clubs/${club.id}/audit-logs`);
		expect(response.status).toBe(200);
		expect(response.body.pagination).toMatchObject({ page: 1, perPage: 25 });
		const entry = response.body.logs.find((l: { actionType: string }) => l.actionType === "CLUB_CREATE");
		expect(entry).toBeDefined();
		expect(entry.clubId).toBe(club.id);
		expect(entry.user.id).toBe(owner.id);
	});

	test("filters by actionType", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		await api(owner.cookie).put(`/api/clubs/${club.id}`, { name: "Renamed Club" });

		const response = await api(owner.cookie).get(`/api/clubs/${club.id}/audit-logs?actionType=CLUB_UPDATE`);
		expect(response.status).toBe(200);
		for (const log of response.body.logs) {
			expect(log.actionType).toBe("CLUB_UPDATE");
		}
		expect(response.body.logs.length).toBeGreaterThan(0);
	});

	test("filters by search against the actionType", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).get(`/api/clubs/${club.id}/audit-logs?search=CLUB_CREATE`);
		expect(response.status).toBe(200);
		expect(response.body.logs.length).toBeGreaterThan(0);
		for (const log of response.body.logs) {
			expect(log.actionType).toContain("CLUB_CREATE");
		}
	});

	test("rejects an invalid perPage", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).get(`/api/clubs/${club.id}/audit-logs?perPage=0`);
		expect(response.status).toBe(400);
	});
});
