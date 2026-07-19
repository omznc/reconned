import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin } from "../helpers/auth";
import { api } from "../helpers/client";

describe("admin users", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/users");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/users");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can list users, search for one, and get its details", async () => {
		const admin = await makeAdmin(await createUser());
		const target = await createUser();

		const list = await api(admin.cookie).get(`/api/admin/users?search=${encodeURIComponent(target.email)}`);
		expect(list.status).toBe(200);
		expect(list.body.users.map((u: { id: string }) => u.id)).toContain(target.id);
		expect(list.body.pagination).toMatchObject({ page: 1 });
		const listed = list.body.users.find((u: { id: string }) => u.id === target.id);
		expect(listed.clubMembership).toBeArray();

		const get = await api(admin.cookie).get(`/api/admin/users/${target.id}`);
		expect(get.status).toBe(200);
		expect(get.body.id).toBe(target.id);
		expect(get.body.email).toBe(target.email);
		expect(get.body.clubMembership).toBeArray();
	});

	test("getting a non-existent user returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/users/does-not-exist");
		expect(response.status).toBe(404);
		expect(response.body.error.code).toBe("NOT_FOUND");
	});

	test("non-admin cannot get user details", async () => {
		const user = await createUser();
		const target = await createUser();

		const response = await api(user.cookie).get(`/api/admin/users/${target.id}`);
		expect(response.status).toBe(403);
	});
});
