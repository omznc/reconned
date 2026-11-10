import { describe, expect, test } from "bun:test";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Erasure Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function deleteAccount(user: TestUser) {
	const response = await api(user.cookie).post(`/api/users/${user.id}/delete`, {
		password: user.password,
	});
	expect(response.status).toBe(200);
}

describe("account erasure", () => {
	test("leaves no row anywhere keyed to the user id or email", async () => {
		const user = await createUser();
		await deleteAccount(user);

		const users = await testDb`SELECT id FROM "User" WHERE id = ${user.id} OR email = ${user.email}`;
		expect(users).toBeEmpty();

		// Cascades: better-auth credentials and sessions must not outlive the account.
		const accounts = await testDb`SELECT id FROM "Account" WHERE "userId" = ${user.id}`;
		const sessions = await testDb`SELECT id FROM "Session" WHERE "userId" = ${user.id}`;
		expect(accounts).toBeEmpty();
		expect(sessions).toBeEmpty();
	});

	// ClubAuditLog.userId is ON DELETE SET NULL, so these rows deliberately outlive the account
	// for club-governance reasons. Retaining the action is defensible; retaining the actor's IP
	// is not, and nulling the foreign key alone does not anonymise the row.
	test("keeps club audit entries but strips the actor's IP and user agent", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		// Simulates a route that records the request context — nothing does today, but the
		// columns exist and the erasure path must hold regardless of what fills them.
		await testDb`
			UPDATE "ClubAuditLog"
			SET "ipAddress" = '203.0.113.7', "userAgent" = 'Mozilla/5.0 (test)'
			WHERE "userId" = ${owner.id}
		`;
		const before = await testDb`SELECT id FROM "ClubAuditLog" WHERE "userId" = ${owner.id}`;
		expect(before.length).toBeGreaterThan(0);

		await deleteAccount(owner);

		const after =
			await testDb`SELECT "userId", "ipAddress", "userAgent" FROM "ClubAuditLog" WHERE "clubId" = ${club.id}`;
		expect(after.length).toBeGreaterThan(0);
		for (const row of after) {
			expect(row.userId).toBeNull();
			expect(row.ipAddress).toBeNull();
			expect(row.userAgent).toBeNull();
		}
	});

	// The processors are unreachable in tests, which is exactly the case that must not strand a
	// half-deleted account: erasure is best-effort past the commit, never a rollback.
	test("succeeds even when third-party erasure cannot complete", async () => {
		const user = await createUser();
		await deleteAccount(user);

		const rows = await testDb`SELECT id FROM "User" WHERE id = ${user.id}`;
		expect(rows).toBeEmpty();
	});

	test("still transfers club ownership before erasing the owner", async () => {
		const owner = await createUser();
		const manager = await createUser();
		const club = await createClub(owner);

		await testDb`
			INSERT INTO "ClubMembership" (id, "userId", "clubId", role, "startDate", "createdAt", "updatedAt")
			VALUES (${crypto.randomUUID()}, ${manager.id}, ${club.id}, 'MANAGER', NOW(), NOW(), NOW())
		`;

		await deleteAccount(owner);

		const rows = await testDb`
			SELECT role FROM "ClubMembership" WHERE "clubId" = ${club.id} AND "userId" = ${manager.id}
		`;
		expect(rows[0]?.role).toBe("CLUB_OWNER");
	});
});
