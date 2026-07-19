import { describe, expect, test } from "bun:test";
import { createUser } from "../helpers/auth";
import { api } from "../helpers/client";

describe("api keys", () => {
	test("GET /api-keys requires auth and lists keys created by the current user", async () => {
		const unauthenticated = await api().get("/api/api-keys");
		expect(unauthenticated.status).toBe(401);

		const owner = await createUser();
		const empty = await api(owner.cookie).get("/api/api-keys");
		expect(empty.status).toBe(200);
		expect(empty.body.apiKeys).toEqual([]);

		const created = await api(owner.cookie).post("/api/api-keys", { name: "CI key" });
		expect(created.status).toBe(200);
		expect(created.body.name).toBe("CI key");
		expect(created.body.key).toBeString();

		const list = await api(owner.cookie).get("/api/api-keys");
		expect(list.status).toBe(200);
		expect(list.body.apiKeys.map((k: { id: string }) => k.id)).toContain(created.body.id);
		// Listing must never leak the raw secret back out.
		expect(list.body.apiKeys[0].key).toBeUndefined();
	});

	test("POST /api-keys requires auth and validates the name", async () => {
		const unauthenticated = await api().post("/api/api-keys", { name: "x" });
		expect(unauthenticated.status).toBe(401);

		const owner = await createUser();
		const missingName = await api(owner.cookie).post("/api/api-keys", {});
		expect(missingName.status).toBe(400);

		const emptyName = await api(owner.cookie).post("/api/api-keys", { name: "" });
		expect(emptyName.status).toBe(400);

		const tooLong = await api(owner.cookie).post("/api/api-keys", { name: "x".repeat(51) });
		expect(tooLong.status).toBe(400);
	});

	test("POST /api-keys rejects a request once the per-user limit is reached", async () => {
		const owner = await createUser();
		for (let i = 0; i < 10; i++) {
			const response = await api(owner.cookie).post("/api/api-keys", { name: `key-${i}` });
			expect(response.status).toBe(200);
		}
		const overLimit = await api(owner.cookie).post("/api/api-keys", { name: "one-too-many" });
		expect(overLimit.status).toBe(400);
	});

	test("a created API key authenticates subsequent requests via the x-api-key header", async () => {
		const owner = await createUser();
		const created = await api(owner.cookie).post("/api/api-keys", { name: "Auth key" });
		expect(created.status).toBe(200);
		const rawKey = created.body.key as string;

		const authenticated = await api().get("/api/dashboard/stats", { "x-api-key": rawKey });
		expect(authenticated.status).toBe(200);

		const invalidKey = await api().get("/api/dashboard/stats", { "x-api-key": "rec_not-a-real-key" });
		expect(invalidKey.status).toBe(401);
	});

	test("POST /api-keys/:id/revoke requires auth and disables the key for future authentication", async () => {
		const owner = await createUser();
		const created = await api(owner.cookie).post("/api/api-keys", { name: "Revocable key" });
		expect(created.status).toBe(200);
		const keyId = created.body.id as string;
		const rawKey = created.body.key as string;

		const unauthenticated = await api().post(`/api/api-keys/${keyId}/revoke`);
		expect(unauthenticated.status).toBe(401);

		const revoked = await api(owner.cookie).post(`/api/api-keys/${keyId}/revoke`);
		expect(revoked.status).toBe(200);
		expect(revoked.body.success).toBeTrue();

		const usingRevokedKey = await api().get("/api/dashboard/stats", { "x-api-key": rawKey });
		expect(usingRevokedKey.status).toBe(401);
	});
});
