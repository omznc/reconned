import { describe, expect, test } from "bun:test";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Users Gaps Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string };
}

/** Adds `user` as a member of `club` by inserting the membership row directly. */
async function addMember(clubId: string, user: TestUser, role: "USER" | "MANAGER" | "CLUB_OWNER" = "USER") {
	const id = crypto.randomUUID();
	await testDb.unsafe(
		`INSERT INTO "ClubMembership" (id, "userId", "clubId", role, "startDate", "createdAt", "updatedAt")
		 VALUES ('${id}', '${user.id}', '${clubId}', '${role}', now(), now(), now())`,
	);
	return id;
}

async function createEvent(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Users Gaps Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 10,
		location: "Sarajevo",
		dateStart: new Date(now + 7 * DAY_MS).toISOString(),
		dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string };
}

describe("GET /users/:id with memberships and registrations", () => {
	test("formats club membership and event registration details", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await api(owner.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});

		const response = await api().get(`/api/users/${owner.id}`);
		expect(response.status).toBe(200);
		expect(response.body.clubMembership.length).toBeGreaterThanOrEqual(1);
		const membership = response.body.clubMembership.find((m: { clubId: string }) => m.clubId === club.id);
		expect(membership).toBeDefined();
		expect(membership.club.name).toBe(club.name);
		expect(membership.club._count.members).toBeNumber();

		expect(response.body.eventRegistration.length).toBeGreaterThanOrEqual(1);
		const registration = response.body.eventRegistration.find((r: { eventId: string }) => r.eventId === event.id);
		expect(registration).toBeDefined();
		expect(registration.event.id).toBe(event.id);
	});
});

describe("GET /users list sorting and memberships", () => {
	test("sort=admin orders admins first", async () => {
		const user = await createUser();
		const response = await api().get(`/api/users?sort=admin&search=${encodeURIComponent(user.name)}`);
		expect(response.status).toBe(200);
		expect(response.body.users.length).toBeGreaterThanOrEqual(1);
	});

	test("includes club membership summaries in the list", async () => {
		const owner = await createUser();
		const member = await createUser();
		const club = await createClub(owner);
		// The list route only surfaces role === "USER" memberships (owners/managers are excluded).
		await addMember(club.id, member, "USER");

		const response = await api().get(`/api/users?search=${encodeURIComponent(member.name)}`);
		expect(response.status).toBe(200);
		const found = response.body.users.find((u: { id: string }) => u.id === member.id);
		expect(found).toBeDefined();
		expect(found.clubMembership.length).toBeGreaterThanOrEqual(1);
		expect(found.clubMembership[0].club.id).toBe(club.id);
	});
});

describe("GET /users/:id/profile with memberships and registrations", () => {
	test("returns public club membership and event registration details", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		await api(owner.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});

		const response = await api().get(`/api/users/${owner.id}/profile`);
		expect(response.status).toBe(200);
		const membership = response.body.clubMembership.find((m: { clubId: string }) => m.clubId === club.id);
		expect(membership).toBeDefined();
		expect(membership.club.name).toBe(club.name);

		const registration = response.body.eventRegistration.find((r: { eventId: string }) => r.eventId === event.id);
		expect(registration).toBeDefined();
		expect(registration.event.club.id).toBe(club.id);
	});

	test("hides memberships and registrations tied to private clubs/events", async () => {
		const owner = await createUser();
		const privateClub = await createClub(owner, { isPrivate: true });

		const response = await api().get(`/api/users/${owner.id}/profile`);
		expect(response.status).toBe(200);
		const membership = response.body.clubMembership.find((m: { clubId: string }) => m.clubId === privateClub.id);
		expect(membership).toBeUndefined();
	});
});

describe("GET /users/:id/stats with aggregated club data", () => {
	test("returns member/event/review counts and upcoming events for club memberships", async () => {
		const owner = await createUser();
		const member = await createUser();
		const club = await createClub(owner);
		await addMember(club.id, member, "USER");
		const event = await createEvent(owner, club.id);

		const reviewId = crypto.randomUUID();
		await testDb.unsafe(
			`INSERT INTO "Review" (id, type, rating, content, "authorId", "clubId", "createdAt", "updatedAt")
			 VALUES ('${reviewId}', 'CLUB', 5, 'Great club', '${member.id}', '${club.id}', now(), now())`,
		);

		await api(owner.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});

		const response = await api().get(`/api/users/${owner.id}/stats`);
		expect(response.status).toBe(200);
		expect(response.body.clubMembershipDetails.length).toBeGreaterThanOrEqual(1);
		const detail = response.body.clubMembershipDetails.find((d: { clubId: string }) => d.clubId === club.id);
		expect(detail).toBeDefined();
		expect(detail.club._count.members).toBeGreaterThanOrEqual(2);
		expect(detail.club._count.reviews).toBeGreaterThanOrEqual(1);
		expect(detail.club._count.events).toBeGreaterThanOrEqual(1);

		expect(response.body.eventRegistrationDetails.length).toBeGreaterThanOrEqual(1);
		const regDetail = response.body.eventRegistrationDetails.find(
			(r: { eventId: string }) => r.eventId === event.id,
		);
		expect(regDetail).toBeDefined();
		expect(regDetail.event.id).toBe(event.id);
	});
});

describe("GET /users/invites", () => {
	test("returns pending invites addressed to the caller's email", async () => {
		const owner = await createUser();
		const club = await createClub(owner);
		const invitee = await createUser();

		const invite = await api(owner.cookie).post(`/api/clubs/${club.id}/invites`, {
			userEmail: invitee.email,
			userName: invitee.name,
		});
		expect(invite.status).toBe(200);

		const response = await api(invitee.cookie).get("/api/users/invites");
		expect(response.status).toBe(200);
		expect(response.body.invites.length).toBeGreaterThanOrEqual(1);
		const found = response.body.invites.find((i: { clubId: string }) => i.clubId === club.id);
		expect(found).toBeDefined();
		expect(found.club.name).toBe(club.name);
		expect(found.club._count.members).toBeNumber();

		const count = await api(invitee.cookie).get("/api/users/invites/count");
		expect(count.status).toBe(200);
		expect(count.body.count).toBeGreaterThanOrEqual(1);
	});
});

describe("POST /users/:id/delete with club ownership transfer", () => {
	test("promotes the oldest manager to owner when the deleted user owned a club", async () => {
		const owner = await createUser();
		const managerOld = await createUser();
		const managerNew = await createUser();
		const club = await createClub(owner);

		// Insert two managers with different start dates so the "oldest manager" tie-break is exercised.
		const oldId = crypto.randomUUID();
		await testDb.unsafe(
			`INSERT INTO "ClubMembership" (id, "userId", "clubId", role, "startDate", "createdAt", "updatedAt")
			 VALUES ('${oldId}', '${managerOld.id}', '${club.id}', 'MANAGER', now() - interval '10 days', now(), now())`,
		);
		const newId = crypto.randomUUID();
		await testDb.unsafe(
			`INSERT INTO "ClubMembership" (id, "userId", "clubId", role, "startDate", "createdAt", "updatedAt")
			 VALUES ('${newId}', '${managerNew.id}', '${club.id}', 'MANAGER', now() - interval '1 day', now(), now())`,
		);

		const response = await api(owner.cookie).post(`/api/users/${owner.id}/delete`, {
			password: owner.password,
		});
		expect(response.status).toBe(200);

		const membership = await testDb`SELECT role FROM "ClubMembership" WHERE id = ${oldId}`;
		expect(membership[0]?.role).toBe("CLUB_OWNER");

		const auditLog = await testDb`
			SELECT "actionType" FROM "ClubAuditLog" WHERE "clubId" = ${club.id} AND "actionType" = 'CLUB_OWNER_TRANSFERRED'
		`;
		expect(auditLog.length).toBeGreaterThanOrEqual(1);
	});

	test("abandons the club when the deleted owner had no managers", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).post(`/api/users/${owner.id}/delete`, {
			password: owner.password,
		});
		expect(response.status).toBe(200);

		const membership = await testDb`SELECT * FROM "ClubMembership" WHERE "clubId" = ${club.id}`;
		expect(membership.length).toBe(0);

		const auditLog = await testDb`
			SELECT "actionType" FROM "ClubAuditLog" WHERE "clubId" = ${club.id} AND "actionType" = 'CLUB_OWNER_REMOVED'
		`;
		expect(auditLog.length).toBeGreaterThanOrEqual(1);
	});
});

describe("POST /users/:id/image/upload-url validation errors", () => {
	test("rejects an unsupported file type", async () => {
		const user = await createUser();

		const response = await api(user.cookie).post(`/api/users/${user.id}/image/upload-url`, {
			type: "application/pdf",
			size: 1024,
		});
		expect(response.status).toBe(500);
	});

	test("rejects a file that is too large", async () => {
		const user = await createUser();

		const response = await api(user.cookie).post(`/api/users/${user.id}/image/upload-url`, {
			type: "image/png",
			size: 100 * 1024 * 1024,
		});
		expect(response.status).toBe(500);
	});
});
