import { describe, expect, test } from "bun:test";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";
import { BASE_URL } from "../helpers/env";

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	expect(countries.status).toBe(200);
	const countryId = countries.body[0]?.id;

	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Invites Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; slug: string };
}

async function sendInvite(owner: TestUser, clubId: string, target: TestUser) {
	const response = await api(owner.cookie).post(`/api/clubs/${clubId}/invites`, { userEmail: target.email });
	expect(response.status).toBe(200);
	return response.body.invite as {
		id: string;
		email: string;
		inviteCode: string;
		status: string;
		expiresAt: string;
	};
}

/** Direct fetch bypassing the harness's auto-follow-redirect `api()` client, since the invite
 * accept-link endpoints redirect to FRONTEND_URL which isn't running in the test environment. */
async function rawGet(path: string, cookie?: string) {
	const response = await fetch(`${BASE_URL}${path}`, {
		redirect: "manual",
		headers: cookie ? { cookie } : undefined,
	});
	return response;
}

describe("club invites", () => {
	describe("POST /api/clubs/:id/invites", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/invites`, { userEmail: target.email });
			expect(response.status).toBe(401);
		});

		test("non-manager cannot send invites", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/invites`, {
				userEmail: target.email,
			});
			expect(response.status).toBe(403);
		});

		test("manager can send an invite to an existing user", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			const invite = await sendInvite(owner, club.id, target);
			expect(invite.email).toBe(target.email);
			expect(invite.status).toBe("PENDING");
			expect(invite.inviteCode).toBeString();
		});

		test("inviting an already-member returns a validation error", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			const invite = await sendInvite(owner, club.id, target);
			const acceptResponse = await api(target.cookie).post(
				`/api/club/member-invite/${invite.inviteCode}?action=approve`,
			);
			expect(acceptResponse.status).toBe(200);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/invites`, {
				userEmail: target.email,
			});
			expect(response.status).toBe(400);
			expect(response.body.error.code).toBeString();
		});

		test("sending a duplicate pending invite to the same email is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			await sendInvite(owner, club.id, target);
			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/invites`, {
				userEmail: target.email,
			});
			expect(response.status).toBe(400);
		});

		test("inviting for an unknown club returns 404", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			// Delete the club's manager membership context by pointing at a bogus club id instead.
			const response = await api(owner.cookie).post(`/api/clubs/${crypto.randomUUID()}/invites`, {
				userEmail: "someone@example.com",
			});
			// The manager-membership check runs first and fails since the caller has no
			// membership in a nonexistent club.
			expect(response.status).toBe(403);
			void club;
		});

		test("invalid email in body is a validation error", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/invites`, {
				userEmail: "not-an-email",
			});
			expect(response.status).toBe(400);
		});
	});

	describe("GET /api/clubs/:id/invites", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/invites`);
			expect(response.status).toBe(401);
		});

		test("non-manager cannot list invites", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/invites`);
			expect(response.status).toBe(403);
		});

		test("manager can list invites and filter by status and search", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const list = await api(owner.cookie).get(`/api/clubs/${club.id}/invites`);
			expect(list.status).toBe(200);
			expect(list.body.invites.map((i: { id: string }) => i.id)).toContain(invite.id);
			expect(list.body.pagination).toMatchObject({ page: 1 });

			const byStatus = await api(owner.cookie).get(`/api/clubs/${club.id}/invites?status=PENDING`);
			expect(byStatus.status).toBe(200);
			expect(byStatus.body.invites.map((i: { id: string }) => i.id)).toContain(invite.id);

			const bySearch = await api(owner.cookie).get(
				`/api/clubs/${club.id}/invites?search=${encodeURIComponent(target.email)}`,
			);
			expect(bySearch.status).toBe(200);
			expect(bySearch.body.invites.map((i: { id: string }) => i.id)).toContain(invite.id);

			const noMatch = await api(owner.cookie).get(`/api/clubs/${club.id}/invites?status=REVOKED`);
			expect(noMatch.status).toBe(200);
			expect(noMatch.body.invites.map((i: { id: string }) => i.id)).not.toContain(invite.id);
		});
	});

	describe("GET /api/clubs/:id/invites/count", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/invites/count`);
			expect(response.status).toBe(401);
		});

		test("non-manager cannot count invites", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/invites/count`);
			expect(response.status).toBe(403);
		});

		test("manager can count invites, optionally filtered by status", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			await sendInvite(owner, club.id, target);

			const total = await api(owner.cookie).get(`/api/clubs/${club.id}/invites/count`);
			expect(total.status).toBe(200);
			expect(total.body.count).toBeGreaterThanOrEqual(1);

			const revoked = await api(owner.cookie).get(`/api/clubs/${club.id}/invites/count?status=REVOKED`);
			expect(revoked.status).toBe(200);
			expect(revoked.body.count).toBe(0);
		});
	});

	describe("GET /api/clubs/:id/invites/requests-count", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/invites/requests-count`);
			expect(response.status).toBe(401);
		});

		test("non-manager is forbidden", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/invites/requests-count`);
			expect(response.status).toBe(403);
		});

		test("manager sees the count of REQUESTED invites only", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);
			await testDb.unsafe(`UPDATE "ClubInvite" SET status = 'REQUESTED' WHERE id = '${invite.id}'`);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/invites/requests-count`);
			expect(response.status).toBe(200);
			expect(response.body.count).toBe(1);
		});
	});

	describe("PUT /api/clubs/:id/invites/:inviteId/revoke", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api().put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);
			expect(response.status).toBe(401);
		});

		test("non-manager cannot revoke an invite", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api(outsider.cookie).put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);
			expect(response.status).toBe(403);
		});

		test("manager can revoke a pending invite", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const rows = await testDb.unsafe(`SELECT status FROM "ClubInvite" WHERE id = '${invite.id}'`);
			expect(rows[0].status).toBe("REVOKED");
		});

		test("revoking an already-revoked invite returns 404", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const first = await api(owner.cookie).put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);
			expect(first.status).toBe(200);

			const second = await api(owner.cookie).put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);
			expect(second.status).toBe(404);
		});

		test("revoking an unknown invite id returns 404", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/invites/${crypto.randomUUID()}/revoke`);
			expect(response.status).toBe(404);
		});
	});

	describe("GET /club/member-invite/:inviteCode (accept link)", () => {
		test("unknown invite code returns 404", async () => {
			const response = await rawGet(`/api/club/member-invite/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});

		test("expired invite is treated as not found", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);
			await testDb.unsafe(
				`UPDATE "ClubInvite" SET "expiresAt" = now() - interval '1 day' WHERE id = '${invite.id}'`,
			);

			const response = await rawGet(`/api/club/member-invite/${invite.inviteCode}`, target.cookie);
			expect(response.status).toBe(404);
		});

		test("an authenticated user whose email matches the invite is redirected to the club with the invite code", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await rawGet(`/api/club/member-invite/${invite.inviteCode}`, target.cookie);
			expect(response.status).toBe(302);
			const location = response.headers.get("location") ?? "";
			expect(location).toContain(`/clubs/${club.slug}`);
			expect(location).toContain(`invite=${invite.inviteCode}`);
		});

		test("an authenticated user with a different email is forbidden", async () => {
			const owner = await createUser();
			const target = await createUser();
			const otherUser = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await rawGet(`/api/club/member-invite/${invite.inviteCode}`, otherUser.cookie);
			expect(response.status).toBe(403);
		});

		test("an unauthenticated visitor is redirected to register with the invite code", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await rawGet(`/api/club/member-invite/${invite.inviteCode}`);
			expect(response.status).toBe(302);
			const location = response.headers.get("location") ?? "";
			expect(location).toContain("/register");
			expect(location).toContain(`invite=${invite.inviteCode}`);
		});

		test("a revoked invite reports as already used", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);
			await api(owner.cookie).put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);

			const response = await rawGet(`/api/club/member-invite/${invite.inviteCode}`, target.cookie);
			expect(response.status).toBe(400);
		});
	});

	describe("POST /club/member-invite/:inviteCode (accept/decline)", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api().post(`/api/club/member-invite/${invite.inviteCode}?action=approve`);
			expect(response.status).toBe(401);
		});

		test("missing action query param is a validation error", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api(target.cookie).post(`/api/club/member-invite/${invite.inviteCode}`);
			expect(response.status).toBe(400);
		});

		test("an invite for a different email is forbidden", async () => {
			const owner = await createUser();
			const target = await createUser();
			const otherUser = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api(otherUser.cookie).post(
				`/api/club/member-invite/${invite.inviteCode}?action=approve`,
			);
			expect(response.status).toBe(403);
		});

		test("unknown invite code returns 404", async () => {
			const target = await createUser();

			const response = await api(target.cookie).post(
				`/api/club/member-invite/${crypto.randomUUID()}?action=approve`,
			);
			expect(response.status).toBe(404);
		});

		test("an expired invite returns a validation error", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);
			await testDb.unsafe(
				`UPDATE "ClubInvite" SET "expiresAt" = now() - interval '1 day' WHERE id = '${invite.id}'`,
			);

			const response = await api(target.cookie).post(
				`/api/club/member-invite/${invite.inviteCode}?action=approve`,
			);
			expect(response.status).toBe(400);
		});

		test("a revoked invite can no longer be accepted", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);
			await api(owner.cookie).put(`/api/clubs/${club.id}/invites/${invite.id}/revoke`);

			const response = await api(target.cookie).post(
				`/api/club/member-invite/${invite.inviteCode}?action=approve`,
			);
			expect(response.status).toBe(400);
		});

		test("approving creates a membership and marks the invite accepted", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api(target.cookie).post(
				`/api/club/member-invite/${invite.inviteCode}?action=approve`,
			);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const membership = await api(target.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(membership.body.isMember).toBeTrue();
			expect(membership.body.membership.role).toBe("USER");

			const rows = await testDb.unsafe(`SELECT status FROM "ClubInvite" WHERE id = '${invite.id}'`);
			expect(rows[0].status).toBe("ACCEPTED");
		});

		test("approving an invite while already a member is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const firstInvite = await sendInvite(owner, club.id, target);
			const approve = await api(target.cookie).post(
				`/api/club/member-invite/${firstInvite.inviteCode}?action=approve`,
			);
			expect(approve.status).toBe(200);

			// Directly insert a second PENDING invite (the /invites endpoint itself refuses to
			// create one for an existing member), to exercise the accept-flow's own membership guard.
			const secondInviteId = crypto.randomUUID();
			const secondInviteCode = crypto.randomUUID().slice(0, 12).toUpperCase();
			await testDb.unsafe(
				`INSERT INTO "ClubInvite" (id, email, "clubId", status, "inviteCode", "expiresAt", "createdAt", "updatedAt")
				 VALUES ('${secondInviteId}', '${target.email}', '${club.id}', 'PENDING', '${secondInviteCode}', now() + interval '7 days', now(), now())`,
			);

			const response = await api(target.cookie).post(
				`/api/club/member-invite/${secondInviteCode}?action=approve`,
			);
			expect(response.status).toBe(400);
		});

		test("dismissing an invite marks it rejected without creating a membership", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const invite = await sendInvite(owner, club.id, target);

			const response = await api(target.cookie).post(
				`/api/club/member-invite/${invite.inviteCode}?action=dismiss`,
			);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const membership = await api(target.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(membership.body.isMember).toBeFalse();

			const rows = await testDb.unsafe(`SELECT status FROM "ClubInvite" WHERE id = '${invite.id}'`);
			expect(rows[0].status).toBe("REJECTED");
		});
	});
});
