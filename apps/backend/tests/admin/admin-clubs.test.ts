import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Admin Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string };
}

describe("admin clubs", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/clubs");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/clubs");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can list clubs (has an owner) and get a single club", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const club = await createClub(owner);

		const list = await api(admin.cookie).get(`/api/admin/clubs?search=${encodeURIComponent(club.name)}`);
		expect(list.status).toBe(200);
		expect(list.body.clubs.map((c: { id: string }) => c.id)).toContain(club.id);
		expect(list.body.pagination).toMatchObject({ page: 1 });

		const get = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(get.status).toBe(200);
		expect(get.body.id).toBe(club.id);
	});

	test("getting a club with no owner via the regular admin clubs endpoint returns 404", async () => {
		// /admin/clubs/:id requires the club to have a CLUB_OWNER membership; unclaimed clubs
		// created via /admin/unclaimed-clubs have none, so they 404 here by design.
		const admin = await makeAdmin(await createUser());
		const created = await api(admin.cookie).post("/api/admin/unclaimed-clubs", {
			name: `Unowned Club ${crypto.randomUUID().slice(0, 8)}`,
		});
		expect(created.status).toBe(200);

		const get = await api(admin.cookie).get(`/api/admin/clubs/${created.body.id}`);
		expect(get.status).toBe(404);
	});

	test("getting a non-existent club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/clubs/does-not-exist");
		expect(response.status).toBe(404);
	});

	test("admin can ban and unban a club", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const club = await createClub(owner);

		const ban = await api(admin.cookie).put(`/api/admin/clubs/${club.id}/ban`, {});
		expect(ban.status).toBe(200);
		expect(ban.body.success).toBeTrue();

		const afterBan = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(afterBan.body.banned).toBeTrue();

		const unban = await api(admin.cookie).put(`/api/admin/clubs/${club.id}/unban`, {});
		expect(unban.status).toBe(200);
		expect(unban.body.success).toBeTrue();

		const afterUnban = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(afterUnban.body.banned).toBeFalse();
	});

	test("banning a non-existent club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).put("/api/admin/clubs/does-not-exist/ban", {});
		expect(response.status).toBe(404);
	});

	test("non-admin cannot ban a club", async () => {
		const user = await createUser();
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(user.cookie).put(`/api/admin/clubs/${club.id}/ban`, {});
		expect(response.status).toBe(403);
	});

	test("admin can verify and unverify a club", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const club = await createClub(owner);

		const verify = await api(admin.cookie).put(`/api/admin/clubs/${club.id}/verify`, {});
		expect(verify.status).toBe(200);
		expect(verify.body.success).toBeTrue();

		const afterVerify = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(afterVerify.body.verified).toBeTrue();

		const unverify = await api(admin.cookie).put(`/api/admin/clubs/${club.id}/unverify`, {});
		expect(unverify.status).toBe(200);
		expect(unverify.body.success).toBeTrue();

		const afterUnverify = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(afterUnverify.body.verified).toBeFalse();
	});

	test("verifying a non-existent club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).put("/api/admin/clubs/does-not-exist/verify", {});
		expect(response.status).toBe(404);
	});

	test("admin can delete a club", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const club = await createClub(owner);

		const del = await api(admin.cookie).delete(`/api/admin/clubs/${club.id}`);
		expect(del.status).toBe(200);
		expect(del.body.success).toBeTrue();

		const getAfterDelete = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(getAfterDelete.status).toBe(404);
	});

	test("deleting a non-existent club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).delete("/api/admin/clubs/does-not-exist");
		expect(response.status).toBe(404);
	});

	test("non-admin cannot delete a club", async () => {
		const admin = await makeAdmin(await createUser());
		const user = await createUser();
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(user.cookie).delete(`/api/admin/clubs/${club.id}`);
		expect(response.status).toBe(403);

		const stillThere = await api(admin.cookie).get(`/api/admin/clubs/${club.id}`);
		expect(stillThere.status).toBe(200);
	});
});
