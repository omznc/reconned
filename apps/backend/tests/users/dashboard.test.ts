import { describe, expect, test } from "bun:test";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Dashboard Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string };
}

async function createEvent(owner: TestUser, clubId: string) {
	const now = Date.now();
	const response = await api(owner.cookie).post("/api/events", {
		clubId,
		name: `Dashboard Event ${crypto.randomUUID().slice(0, 8)}`,
		description: "An event created by the integration test suite",
		costPerPerson: 0,
		location: "Sarajevo",
		dateStart: new Date(now + DAY_MS).toISOString(),
		dateEnd: new Date(now + 2 * DAY_MS).toISOString(),
		dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
		dateRegistrationsClose: new Date(now + DAY_MS).toISOString(),
	});
	expect(response.status).toBe(200);
	return response.body.event as { id: string; name: string };
}

describe("dashboard", () => {
	test("GET /dashboard/clubs requires auth and lists a member's clubs with upcoming events", async () => {
		const unauthenticated = await api().get("/api/dashboard/clubs");
		expect(unauthenticated.status).toBe(401);

		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const response = await api(owner.cookie).get("/api/dashboard/clubs");
		expect(response.status).toBe(200);
		const entry = response.body.clubs.find((c: { id: string }) => c.id === club.id);
		expect(entry).toBeDefined();
		expect(entry.membershipRole).toBe("CLUB_OWNER");
		expect(entry._count.members).toBeGreaterThanOrEqual(1);
		expect(entry.events.map((e: { id: string }) => e.id)).toContain(event.id);
	});

	test("GET /dashboard/clubs returns an empty list for a user with no memberships", async () => {
		const lonely = await createUser();
		const response = await api(lonely.cookie).get("/api/dashboard/clubs");
		expect(response.status).toBe(200);
		expect(response.body.clubs).toEqual([]);
	});

	test("GET /dashboard/stats requires auth and reflects memberships, registrations, and reviews", async () => {
		const unauthenticated = await api().get("/api/dashboard/stats");
		expect(unauthenticated.status).toBe(401);

		const owner = await createUser();
		const club = await createClub(owner);
		const event = await createEvent(owner, club.id);

		const registration = await api(owner.cookie).post(`/api/events/${event.id}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(registration.status).toBe(200);

		const response = await api(owner.cookie).get("/api/dashboard/stats");
		expect(response.status).toBe(200);
		expect(response.body.clubMembership).toBeGreaterThanOrEqual(1);
		expect(response.body.eventRegistration).toBeGreaterThanOrEqual(1);
		expect(response.body.eventRegistrationDetails.map((r: { id: string }) => r.id)).toContain(
			registration.body.registration.id,
		);
		const membershipDetail = response.body.clubMembershipDetails.find(
			(m: { club: { id: string } | null }) => m.club?.id === club.id,
		);
		expect(membershipDetail).toBeDefined();
		expect(membershipDetail.role).toBe("CLUB_OWNER");
	});

	test("GET /dashboard/invites-count requires auth and counts pending club invites for the user's email", async () => {
		const unauthenticated = await api().get("/api/dashboard/invites-count");
		expect(unauthenticated.status).toBe(401);

		const invitee = await createUser();
		const zero = await api(invitee.cookie).get("/api/dashboard/invites-count");
		expect(zero.status).toBe(200);
		expect(zero.body.count).toBe(0);

		const owner = await createUser();
		const club = await createClub(owner);
		// Insert the pending invite directly instead of going through POST /clubs/:id/invites,
		// which also sends an invitation email as a side effect.
		await testDb`INSERT INTO "ClubInvite" (id, email, "clubId", status, "inviteCode", "expiresAt")
			VALUES (${crypto.randomUUID()}, ${invitee.email}, ${club.id}, 'PENDING', ${Math.random().toString(36).slice(2, 16).toUpperCase()}, ${new Date(Date.now() + DAY_MS).toISOString()})`;

		const withInvite = await api(invitee.cookie).get("/api/dashboard/invites-count");
		expect(withInvite.status).toBe(200);
		expect(withInvite.body.count).toBeGreaterThanOrEqual(1);
	});

	test("GET /dashboard/invite-requests-count requires auth and returns an empty list for a non-manager", async () => {
		const unauthenticated = await api().get("/api/dashboard/invite-requests-count");
		expect(unauthenticated.status).toBe(401);

		const nonManager = await createUser();
		const response = await api(nonManager.cookie).get("/api/dashboard/invite-requests-count");
		expect(response.status).toBe(200);
		expect(response.body.clubs).toEqual([]);
	});
});
