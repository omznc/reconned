import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Task Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

/** Inserts an already-expired invite row directly; the invite creation API always sets a
 * future expiry, so the "clean-expired-invites" task's target state is only reachable via SQL. */
async function createExpiredInvite(clubId: string) {
	const id = crypto.randomUUID();
	const inviteCode = crypto.randomUUID();
	await testDb.unsafe(
		`INSERT INTO "ClubInvite" (id, email, "clubId", status, "inviteCode", "expiresAt", "createdAt", "updatedAt")
		 VALUES ('${id}', 'expired-${id}@example.com', '${clubId}', 'PENDING', '${inviteCode}', now() - interval '1 day', now(), now())`,
	);
	return id;
}

describe("admin tasks", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/tasks");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/tasks");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can list background tasks", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/tasks");
		expect(response.status).toBe(200);
		expect(response.body.tasks).toBeArray();
		expect(response.body.tasks.some((t: { name: string }) => t.name === "clean-expired-invites")).toBeTrue();
	});

	test("admin can run the clean-expired-invites task, which deletes only expired invites", async () => {
		const admin = await makeAdmin(await createUser());
		const owner = await createUser();
		const club = await createClub(owner);
		const expiredInviteId = await createExpiredInvite(club.id);

		const response = await api(admin.cookie).post("/api/admin/tasks/clean-expired-invites/run", {});
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();
		expect(response.body.data?.deletedCount).toBeGreaterThanOrEqual(1);

		const rows = await testDb.unsafe(`SELECT id FROM "ClubInvite" WHERE id = '${expiredInviteId}'`);
		expect(rows.length).toBe(0);
	});

	test("running an unknown task returns 500", async () => {
		// The route's switch-default throws apiError.notFound("Task"), but that throw happens
		// inside the surrounding try/catch, which re-wraps any error (including AppError) into
		// apiError.internal — so callers actually observe a 500, not a 404.
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).post("/api/admin/tasks/not-a-real-task/run", {});
		expect(response.status).toBe(500);
	});

	test("non-admin cannot run a task", async () => {
		const user = await createUser();
		const response = await api(user.cookie).post("/api/admin/tasks/clean-expired-invites/run", {});
		expect(response.status).toBe(403);
	});
});
