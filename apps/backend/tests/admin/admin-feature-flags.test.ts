import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createFlag(admin: TestUser, overrides: Record<string, unknown> = {}) {
	const response = await api(admin.cookie).post("/api/admin/feature-flags", {
		name: `TEST_FLAG_${crypto
			.randomUUID()
			.slice(0, 8)
			.toUpperCase()
			.replace(/[^A-Z]/g, "X")}`,
		description: "A test flag",
		enabled: false,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body as { id: string; name: string; enabled: boolean };
}

describe("admin feature flags", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/feature-flags");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/feature-flags");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can create, list, get, update and delete a feature flag", async () => {
		const admin = await makeAdmin(await createUser());
		const flag = await createFlag(admin);
		expect(flag.enabled).toBeFalse();

		const list = await api(admin.cookie).get("/api/admin/feature-flags");
		expect(list.status).toBe(200);
		expect(list.body.featureFlags.map((f: { id: string }) => f.id)).toContain(flag.id);
		expect(list.body.pagination).toMatchObject({ page: 1 });

		const get = await api(admin.cookie).get(`/api/admin/feature-flags/${flag.id}`);
		expect(get.status).toBe(200);
		expect(get.body.id).toBe(flag.id);

		const updated = await api(admin.cookie).put(`/api/admin/feature-flags/${flag.id}`, {
			enabled: true,
		});
		expect(updated.status).toBe(200);
		expect(updated.body.enabled).toBeTrue();

		const deleted = await api(admin.cookie).delete(`/api/admin/feature-flags/${flag.id}`);
		expect(deleted.status).toBe(200);
		expect(deleted.body.success).toBeTrue();

		const getAfterDelete = await api(admin.cookie).get(`/api/admin/feature-flags/${flag.id}`);
		expect(getAfterDelete.status).toBe(404);
	});

	test("feature flag names are normalized to uppercase with underscores", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).post("/api/admin/feature-flags", {
			name: "MY_LOWERCASE_FLAG",
			enabled: true,
		});
		expect(response.status).toBe(200);
		expect(response.body.name).toBe("MY_LOWERCASE_FLAG");
	});

	test("creating a feature flag with an invalid name fails validation", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).post("/api/admin/feature-flags", {
			name: "not valid!!",
		});
		expect(response.status).toBe(400);
	});

	test("creating a feature flag without a name fails validation", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).post("/api/admin/feature-flags", {});
		expect(response.status).toBe(400);
	});

	test("getting a non-existent feature flag returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/feature-flags/does-not-exist");
		expect(response.status).toBe(404);
		expect(response.body.error.code).toBe("NOT_FOUND");
	});

	test("updating a non-existent feature flag returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).put("/api/admin/feature-flags/does-not-exist", {
			enabled: true,
		});
		expect(response.status).toBe(404);
	});

	test("deleting a non-existent feature flag returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).delete("/api/admin/feature-flags/does-not-exist");
		expect(response.status).toBe(404);
	});

	test("non-admin cannot create a feature flag", async () => {
		const user = await createUser();
		const response = await api(user.cookie).post("/api/admin/feature-flags", {
			name: "SHOULD_NOT_EXIST",
		});
		expect(response.status).toBe(403);
	});
});
