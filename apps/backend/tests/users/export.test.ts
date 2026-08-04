import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Export Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

describe("GET /users/:id/export", () => {
	test("requires authentication", async () => {
		const user = await createUser();
		const response = await api().get(`/api/users/${user.id}/export`);
		expect(response.status).toBe(401);
	});

	test("refuses to export another user's data", async () => {
		const subject = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).get(`/api/users/${subject.id}/export`);
		expect(response.status).toBe(401);
	});

	// Deliberately narrower than the rest of the users routes, which let admins through.
	test("refuses even an admin, because access is a self-service right", async () => {
		const subject = await createUser();
		const admin = await makeAdmin(await createUser());

		const response = await api(admin.cookie).get(`/api/users/${subject.id}/export`);
		expect(response.status).toBe(401);
	});

	test("returns the subject's own profile and every section", async () => {
		const user = await createUser();

		const response = await api(user.cookie).get(`/api/users/${user.id}/export`);
		expect(response.status).toBe(200);
		expect(response.body.profile.id).toBe(user.id);
		expect(response.body.profile.email).toBe(user.email);
		expect(response.body.profile.name).toBe(user.name);

		for (const section of [
			"signInMethods",
			"sessions",
			"clubMemberships",
			"clubInvites",
			"eventBookings",
			"eventAttendance",
			"reviewsWritten",
			"reviewsReceived",
			"reviewEdits",
			"achievements",
			"clubAuditLogs",
			"apiKeys",
			"oauthConsents",
		]) {
			expect(response.body[section]).toBeArray();
		}

		expect(response.body.meta.subjectId).toBe(user.id);
		expect(response.body.meta.excluded).toBeArray();
	});

	test("is served as a downloadable file and never cached", async () => {
		const user = await createUser();

		const response = await api(user.cookie).get(`/api/users/${user.id}/export`);
		expect(response.headers.get("content-disposition")).toContain("attachment");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	test("describes sign-in methods without leaking the credentials themselves", async () => {
		const user = await createUser();

		const response = await api(user.cookie).get(`/api/users/${user.id}/export`);
		expect(response.body.signInMethods).not.toBeEmpty();
		expect(response.body.signInMethods[0].type).toBe("password");

		// The password itself must not appear anywhere in the file, hashed or otherwise.
		const serialised = JSON.stringify(response.body);
		expect(serialised).not.toContain(user.password);
		expect(serialised).not.toContain("$argon2");
		expect(serialised).not.toContain("$2a$");
	});

	test("includes the subject's own club membership and audit trail", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).get(`/api/users/${owner.id}/export`);
		expect(response.status).toBe(200);
		expect(response.body.clubMemberships.some((m: { clubId: string }) => m.clubId === club.id)).toBe(true);
		expect(response.body.clubAuditLogs.some((l: { clubId: string }) => l.clubId === club.id)).toBe(true);
	});

	// Art. 22(4): one person's export must not become a way to read another person's details.
	test("redacts a third party's email and the invite code from audit log actionData", async () => {
		const owner = await createUser();
		const invitee = await createUser();
		const club = await createClub(owner);

		const invite = await api(owner.cookie).post(`/api/clubs/${club.id}/invites`, {
			userEmail: invitee.email,
			userName: invitee.name,
		});
		expect(invite.status).toBeLessThan(300);

		const response = await api(owner.cookie).get(`/api/users/${owner.id}/export`);
		expect(response.status).toBe(200);

		const serialised = JSON.stringify(response.body.clubAuditLogs);
		expect(serialised).not.toContain(invitee.email);
		expect(serialised).not.toContain(invitee.name);
		expect(serialised).toContain("[redacted]");

		const inviteLog = response.body.clubAuditLogs.find(
			(l: { actionType: string }) => l.actionType === "MEMBER_INVITE",
		);
		expect(inviteLog).toBeDefined();
		expect(inviteLog.actionData.inviteCode).toBe("[redacted]");
		// The subject's own record of the action survives the redaction.
		expect(inviteLog.actionData.inviteId).toBeString();
	});
});
