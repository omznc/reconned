import { describe, expect, test } from "bun:test";
import { describeRetention, RETENTION, retentionDays } from "../../src/lib/retention-periods";
import {
	purgeExpiredSessions,
	purgeExpiredVerifications,
	stripAgedAuditLogIdentifiers,
} from "../../src/tasks/retention";
import { createUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY = 24 * 60 * 60 * 1000;

function agoIso(ms: number) {
	return new Date(Date.now() - ms).toISOString();
}

/**
 * Retention is tested against rows seeded with explicit timestamps rather than by waiting, so each
 * case pins one side of a boundary. A task that deletes nothing and a task that deletes everything
 * both pass a "did it run" test — only the boundary tells them apart.
 */
describe("retention: expired sessions", () => {
	test("deletes a session expired past the retention period", async () => {
		const user = await createUser();
		const id = `sess-old-${crypto.randomUUID()}`;

		await testDb`
			INSERT INTO "Session" (id, "expiresAt", "ipAddress", "userAgent", "userId", token, "createdAt", "updatedAt")
			VALUES (${id}, ${agoIso(RETENTION.EXPIRED_SESSION + DAY)}, '203.0.113.9', 'Mozilla/5.0 (test)',
			        ${user.id}, ${`tok-${id}`}, ${agoIso(400 * DAY)}, ${agoIso(400 * DAY)})
		`;

		await purgeExpiredSessions();

		const rows = await testDb`SELECT id FROM "Session" WHERE id = ${id}`;
		expect(rows).toBeEmpty();
	});

	test("keeps a session that expired recently, inside the retention window", async () => {
		const user = await createUser();
		const id = `sess-recent-${crypto.randomUUID()}`;

		// Expired, so it authenticates nothing — but still within the window in which "was this
		// really me?" is answerable. Deleting it early would destroy the only record of the login.
		await testDb`
			INSERT INTO "Session" (id, "expiresAt", "ipAddress", "userAgent", "userId", token, "createdAt", "updatedAt")
			VALUES (${id}, ${agoIso(DAY)}, '203.0.113.9', 'Mozilla/5.0 (test)',
			        ${user.id}, ${`tok-${id}`}, ${agoIso(30 * DAY)}, ${agoIso(30 * DAY)})
		`;

		await purgeExpiredSessions();

		const rows = await testDb`SELECT id FROM "Session" WHERE id = ${id}`;
		expect(rows).toHaveLength(1);
	});

	test("leaves a live session alone", async () => {
		const user = await createUser();

		// The session minted by createUser() is valid; purging it would log a real user out.
		await purgeExpiredSessions();

		const rows = await testDb`SELECT id FROM "Session" WHERE "userId" = ${user.id}`;
		expect(rows.length).toBeGreaterThan(0);

		const me = await api(user.cookie).get("/api/users/me/clubs");
		expect(me.status).toBe(200);
	});
});

describe("retention: expired verification tokens", () => {
	test("deletes a token expired past the retention period, keeps a fresher one", async () => {
		const oldId = `ver-old-${crypto.randomUUID()}`;
		const recentId = `ver-recent-${crypto.randomUUID()}`;

		await testDb`
			INSERT INTO "Verification" (id, identifier, value, "expiresAt", "createdAt", "updatedAt")
			VALUES (${oldId}, 'old@example.com', 'token-old', ${agoIso(RETENTION.EXPIRED_VERIFICATION + DAY)},
			        ${agoIso(30 * DAY)}, ${agoIso(30 * DAY)}),
			       (${recentId}, 'recent@example.com', 'token-recent', ${agoIso(DAY)},
			        ${agoIso(2 * DAY)}, ${agoIso(2 * DAY)})
		`;

		await purgeExpiredVerifications();

		expect(await testDb`SELECT id FROM "Verification" WHERE id = ${oldId}`).toBeEmpty();
		expect(await testDb`SELECT id FROM "Verification" WHERE id = ${recentId}`).toHaveLength(1);
	});
});

describe("retention: audit log network identifiers", () => {
	test("nulls IP and user agent past the period without deleting the entry", async () => {
		const user = await createUser();
		const countries = await api(user.cookie).get("/api/countries");
		const club = await api(user.cookie).post("/api/clubs", {
			name: `Retention Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId: countries.body[0]?.id,
			location: "Sarajevo",
		});
		expect(club.status).toBe(200);

		const id = `audit-old-${crypto.randomUUID()}`;
		await testDb`
			INSERT INTO "ClubAuditLog" (id, "createdAt", "userId", "clubId", "actionType", "actionData",
			                            "ipAddress", "userAgent")
			VALUES (${id}, ${agoIso(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS + DAY)}, ${user.id},
			        ${club.body.club.id}, 'CLUB_UPDATED', '{"field":"name"}'::jsonb,
			        '203.0.113.7', 'Mozilla/5.0 (test)')
		`;

		await stripAgedAuditLogIdentifiers();

		const [row] = await testDb`
			SELECT "ipAddress", "userAgent", "actionType", "userId" FROM "ClubAuditLog" WHERE id = ${id}
		`;

		// The governance record survives; only the surveillance-shaped part of it is removed.
		expect(row).toBeDefined();
		expect(row.ipAddress).toBeNull();
		expect(row.userAgent).toBeNull();
		expect(row.actionType).toBe("CLUB_UPDATED");
		expect(row.userId).toBe(user.id);
	});

	test("leaves identifiers on entries inside the retention window", async () => {
		const user = await createUser();
		const countries = await api(user.cookie).get("/api/countries");
		const club = await api(user.cookie).post("/api/clubs", {
			name: `Retention Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId: countries.body[0]?.id,
			location: "Sarajevo",
		});
		expect(club.status).toBe(200);

		const id = `audit-recent-${crypto.randomUUID()}`;
		await testDb`
			INSERT INTO "ClubAuditLog" (id, "createdAt", "userId", "clubId", "actionType", "actionData",
			                            "ipAddress", "userAgent")
			VALUES (${id}, ${agoIso(DAY)}, ${user.id}, ${club.body.club.id}, 'CLUB_UPDATED',
			        '{"field":"name"}'::jsonb, '203.0.113.7', 'Mozilla/5.0 (test)')
		`;

		await stripAgedAuditLogIdentifiers();

		const [row] = await testDb`SELECT "ipAddress" FROM "ClubAuditLog" WHERE id = ${id}`;
		expect(row.ipAddress).toBe("203.0.113.7");
	});

	test("converges — a second run finds nothing left to update", async () => {
		// Without the is-not-null predicate the statement would rewrite every aged row forever,
		// which is invisible in production except as a daily write storm.
		await stripAgedAuditLogIdentifiers();
		const second = await stripAgedAuditLogIdentifiers();
		expect(second.updated).toBe(0);
	});
});

/**
 * The privacy policy (Art. 15(2)(a)) and the ROPA both state these periods, and both render them
 * from `RETENTION` rather than restating them — a published number the code does not enforce is a
 * false statement to data subjects. These assertions guard the properties that rendering relies on.
 */
describe("retention: published periods", () => {
	test("every enforced period is a whole number of days, which is how they are published", () => {
		for (const [name, period] of Object.entries(RETENTION)) {
			expect(period % DAY, `${name} is not a whole number of days`).toBe(0);
		}
	});

	test("describeRetention() reports the periods the tasks actually enforce", () => {
		const described = new Map(describeRetention().map((row) => [row.data, row.period]));

		expect(described.get("Expired sessions (including IP address and user agent)")).toBe(
			`${retentionDays(RETENTION.EXPIRED_SESSION)} days`,
		);
		expect(described.get("Expired verification tokens")).toBe(
			`${retentionDays(RETENTION.EXPIRED_VERIFICATION)} days`,
		);
		expect(described.get("IP address and user agent on club audit entries")).toBe(
			`${retentionDays(RETENTION.AUDIT_LOG_NETWORK_IDENTIFIERS)} days`,
		);
	});

	// The absence of an account expiry is a decision, not an oversight (see §6.1 of docs/PLAN.md), so it
	// is stated as a period rather than omitted from the table.
	test("states a period for account data rather than leaving the row out", () => {
		const account = describeRetention().find((row) => row.data === "Account and profile data");

		expect(account?.period).toBe("For as long as the account exists");
	});

	test("covers every enforced period, so a new one cannot go unpublished", () => {
		// One row per RETENTION key, plus the account row that has no scheduled expiry.
		expect(describeRetention()).toHaveLength(Object.keys(RETENTION).length + 1);
	});
});
