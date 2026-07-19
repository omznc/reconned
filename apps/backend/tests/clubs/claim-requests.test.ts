import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Claim Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

/** Removes the owner membership directly via the DB, since there's no API path to orphan a club. */
async function makeClubOwnerless(clubId: string) {
	await testDb.unsafe(`DELETE FROM "ClubMembership" WHERE "clubId" = '${clubId}' AND role = 'CLUB_OWNER'`);
}

describe("clubs claim-requests", () => {
	test("requires authentication", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		await makeClubOwnerless(club.id);

		const response = await api().post(`/api/clubs/${club.id}/claim-request`, {});
		expect(response.status).toBe(401);
	});

	test("returns 404 for a non-existent club", async () => {
		const requester = await createUser();
		const response = await api(requester.cookie).post(`/api/clubs/${crypto.randomUUID()}/claim-request`, {});
		expect(response.status).toBe(404);
	});

	test("rejects a claim request for a club that already has an owner", async () => {
		const owner = await createUser();
		const requester = await createUser();
		const club = await createClub(owner);

		const response = await api(requester.cookie).post(`/api/clubs/${club.id}/claim-request`, {});
		expect(response.status).toBe(400);
	});

	test("submits a claim request for an unclaimed club (admin notification email; sending is disabled in tests)", async () => {
		const owner = await createUser();
		const requester = await createUser();
		const club = await createClub(owner);
		await makeClubOwnerless(club.id);
		// The endpoint 500s if no admin exists to notify, so ensure at least one is present.
		await makeAdmin(await createUser());

		const response = await api(requester.cookie).post(`/api/clubs/${club.id}/claim-request`, {
			message: "I would like to claim this club.",
		});
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();
	});
});
