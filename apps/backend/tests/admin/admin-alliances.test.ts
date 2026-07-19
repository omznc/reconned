import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Alliance Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function createAlliance(admin: TestUser) {
	const countries = await api(admin.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(admin.cookie).post("/api/admin/alliances", {
		name: `Test Alliance ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
	});
	expect(response.status).toBe(200);
	return response.body.alliance as { id: number; name: string; countryId: number };
}

describe("admin alliances", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/alliances");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/alliances");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can list, create, get, update and delete an alliance", async () => {
		const admin = await makeAdmin(await createUser());
		const alliance = await createAlliance(admin);

		const list = await api(admin.cookie).get("/api/admin/alliances");
		expect(list.status).toBe(200);
		expect(list.body.alliances.map((a: { id: number }) => a.id)).toContain(alliance.id);
		expect(list.body.pagination).toMatchObject({ page: 1 });

		const get = await api(admin.cookie).get(`/api/admin/alliances/${alliance.id}`);
		expect(get.status).toBe(200);
		expect(get.body.alliance.id).toBe(alliance.id);

		const updated = await api(admin.cookie).put(`/api/admin/alliances/${alliance.id}`, {
			name: "Updated Alliance Name",
		});
		expect(updated.status).toBe(200);
		expect(updated.body.alliance.name).toBe("Updated Alliance Name");

		const deleted = await api(admin.cookie).delete(`/api/admin/alliances/${alliance.id}`);
		expect(deleted.status).toBe(200);
		expect(deleted.body.success).toBeTrue();

		const getAfterDelete = await api(admin.cookie).get(`/api/admin/alliances/${alliance.id}`);
		expect(getAfterDelete.status).toBe(404);
	});

	test("creating an alliance with an unknown country fails validation", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).post("/api/admin/alliances", {
			name: "Bad Country Alliance",
			countryId: 999999,
		});
		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
	});

	test("getting a non-existent alliance returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/alliances/999999");
		expect(response.status).toBe(404);
		expect(response.body.error.code).toBe("NOT_FOUND");
	});

	test("getting an alliance with a non-numeric id returns 400", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/alliances/not-a-number");
		expect(response.status).toBe(400);
	});

	test("admin can add and remove a club from an alliance", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const alliance = await createAlliance(admin);
		const club = await createClub(owner);

		const added = await api(admin.cookie).post(`/api/admin/alliances/${alliance.id}/clubs`, {
			clubId: club.id,
		});
		expect(added.status).toBe(200);
		expect(added.body.clubAlliance.clubId).toBe(club.id);

		const duplicate = await api(admin.cookie).post(`/api/admin/alliances/${alliance.id}/clubs`, {
			clubId: club.id,
		});
		expect(duplicate.status).toBe(409);
		expect(duplicate.body.error.code).toBe("CONFLICT");

		const removed = await api(admin.cookie).delete(`/api/admin/alliances/${alliance.id}/clubs/${club.id}`);
		expect(removed.status).toBe(200);
		expect(removed.body.success).toBeTrue();

		const removeAgain = await api(admin.cookie).delete(`/api/admin/alliances/${alliance.id}/clubs/${club.id}`);
		expect(removeAgain.status).toBe(404);
	});

	test("adding a club to a non-existent alliance returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(admin.cookie).post("/api/admin/alliances/999999/clubs", {
			clubId: club.id,
		});
		expect(response.status).toBe(404);
	});
});
