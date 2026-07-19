import { describe, expect, test } from "bun:test";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	expect(countries.status).toBe(200);
	const countryId = countries.body[0]?.id;

	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Members Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string };
}

/** Adds `user` as a plain member of `club` by inserting the membership row directly. */
async function addMember(clubId: string, user: TestUser, role: "USER" | "MANAGER" = "USER") {
	const id = crypto.randomUUID();
	await testDb.unsafe(
		`INSERT INTO "ClubMembership" (id, "userId", "clubId", role, "startDate", "createdAt", "updatedAt")
		 VALUES ('${id}', '${user.id}', '${clubId}', '${role}', now(), now(), now())`,
	);
	return id;
}

describe("club members", () => {
	describe("GET /api/clubs/:id/members", () => {
		test("unauthenticated users can list members of a public club", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/members`);
			expect(response.status).toBe(200);
			expect(response.body.members.length).toBeGreaterThanOrEqual(1);
			expect(response.body.privateCount).toBeNumber();
			expect(response.body.total).toBeGreaterThanOrEqual(1);
		});

		test("non-members are forbidden from listing members of a private club", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner, { isPrivate: true });

			const asOutsider = await api(outsider.cookie).get(`/api/clubs/${club.id}/members`);
			expect(asOutsider.status).toBe(403);
			expect(asOutsider.body.error.code).toBeString();

			const anonymous = await api().get(`/api/clubs/${club.id}/members`);
			expect(anonymous.status).toBe(403);
		});

		test("members can list members of a private club", async () => {
			const owner = await createUser();
			const club = await createClub(owner, { isPrivate: true });

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/members`);
			expect(response.status).toBe(200);
			expect(response.body.members.some((m: { userId: string }) => m.userId === owner.id)).toBeTrue();
		});

		test("an unknown club returns 404", async () => {
			const owner = await createUser();
			const response = await api(owner.cookie).get(`/api/clubs/${crypto.randomUUID()}/members`);
			expect(response.status).toBe(404);
			expect(response.body.error.code).toBeString();
		});
	});

	describe("GET /api/clubs/:id/members/count", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/members/count`);
			expect(response.status).toBe(401);
		});

		test("non-member is forbidden", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/members/count`);
			expect(response.status).toBe(403);
		});

		test("a member can count members, optionally filtered by role", async () => {
			const owner = await createUser();
			const member = await createUser();
			const club = await createClub(owner);
			await addMember(club.id, member, "USER");

			const total = await api(owner.cookie).get(`/api/clubs/${club.id}/members/count`);
			expect(total.status).toBe(200);
			expect(total.body.count).toBe(2);

			const owners = await api(owner.cookie).get(`/api/clubs/${club.id}/members/count?role=CLUB_OWNER`);
			expect(owners.status).toBe(200);
			expect(owners.body.count).toBe(1);
		});
	});

	describe("GET /api/clubs/:id/membership", () => {
		test("reports membership status for the current user", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const asOwner = await api(owner.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(asOwner.status).toBe(200);
			expect(asOwner.body.isMember).toBeTrue();
			expect(asOwner.body.membership.role).toBe("CLUB_OWNER");

			const asOutsider = await api(outsider.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(asOutsider.status).toBe(200);
			expect(asOutsider.body.isMember).toBeFalse();
			expect(asOutsider.body.membership).toBeNull();
		});

		test("anonymous users get isMember false without error", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/membership`);
			expect(response.status).toBe(200);
			expect(response.body.isMember).toBeFalse();
		});
	});

	describe("POST /api/clubs/:id/members", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/members`, { userId: outsider.id });
			expect(response.status).toBe(401);
		});

		test("non-manager cannot add a member", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/members`, { userId: target.id });
			expect(response.status).toBe(403);
		});

		test("manager can add an existing user as a member", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/members`, {
				userId: target.id,
				role: "MANAGER",
			});
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();
			expect(response.body.membership.userId).toBe(target.id);
			expect(response.body.membership.role).toBe("MANAGER");

			const membership = await api(target.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(membership.body.isMember).toBeTrue();
		});

		test("cannot add a user who is already a member", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			await addMember(club.id, target);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/members`, { userId: target.id });
			expect(response.status).toBe(400);
			expect(response.body.error.code).toBeString();
		});

		test("adding a nonexistent user returns 404", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/members`, {
				userId: crypto.randomUUID(),
			});
			expect(response.status).toBe(404);
		});

		test("missing userId is a validation error", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/members`, {});
			expect(response.status).toBe(400);
		});
	});

	describe("DELETE /api/clubs/:id/members/:memberId", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api().delete(`/api/clubs/${club.id}/members/${membershipId}`);
			expect(response.status).toBe(401);
		});

		test("non-manager cannot remove a member", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}/members/${membershipId}`);
			expect(response.status).toBe(403);
		});

		test("manager can remove a regular member", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/members/${membershipId}`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const membership = await api(target.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(membership.body.isMember).toBeFalse();
		});

		test("cannot remove the club owner", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const memberships = await testDb.unsafe(
				`SELECT id FROM "ClubMembership" WHERE "clubId" = '${club.id}' AND "userId" = '${owner.id}'`,
			);
			const ownerMembershipId = memberships[0].id as string;

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/members/${ownerMembershipId}`);
			expect(response.status).toBe(404);
		});

		test("removing an unknown member returns 404", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/members/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});

	describe("PUT /api/clubs/:id/members/:memberId", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api().put(`/api/clubs/${club.id}/members/${membershipId}`, { role: "MANAGER" });
			expect(response.status).toBe(401);
		});

		test("a manager (non-owner) cannot change roles", async () => {
			const owner = await createUser();
			const manager = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			await addMember(club.id, manager, "MANAGER");
			const membershipId = await addMember(club.id, target);

			const response = await api(manager.cookie).put(`/api/clubs/${club.id}/members/${membershipId}`, {
				role: "MANAGER",
			});
			expect(response.status).toBe(403);
		});

		test("owner can promote and demote a member", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const promoted = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}`, {
				role: "MANAGER",
			});
			expect(promoted.status).toBe(200);
			expect(promoted.body.membership.role).toBe("MANAGER");

			const demoted = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}`, {
				role: "USER",
			});
			expect(demoted.status).toBe(200);
			expect(demoted.body.membership.role).toBe("USER");
		});

		test("cannot promote a member to CLUB_OWNER via this endpoint", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}`, {
				role: "CLUB_OWNER",
			});
			expect(response.status).toBe(400);
		});

		test("cannot change the club owner's own role", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const memberships = await testDb.unsafe(
				`SELECT id FROM "ClubMembership" WHERE "clubId" = '${club.id}' AND "userId" = '${owner.id}'`,
			);
			const ownerMembershipId = memberships[0].id as string;

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${ownerMembershipId}`, {
				role: "USER",
			});
			expect(response.status).toBe(400);
		});

		test("invalid role value is a validation error", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}`, {
				role: "NOT_A_ROLE",
			});
			expect(response.status).toBe(400);
		});

		test("unknown member id returns 404", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${crypto.randomUUID()}`, {
				role: "MANAGER",
			});
			expect(response.status).toBe(404);
		});
	});

	describe("PUT /api/clubs/:id/members/:memberId/extend", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api().put(`/api/clubs/${club.id}/members/${membershipId}/extend`, {
				duration: "1",
			});
			expect(response.status).toBe(401);
		});

		test("non-manager cannot extend a membership", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(outsider.cookie).put(`/api/clubs/${club.id}/members/${membershipId}/extend`, {
				duration: "1",
			});
			expect(response.status).toBe(403);
		});

		test("missing duration is a validation error", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}/extend`, {});
			expect(response.status).toBe(400);
		});

		test("invalid duration is a validation error", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}/extend`, {
				duration: "0",
			});
			expect(response.status).toBe(400);
		});

		test("manager can extend a member's duration from today when no prior end date", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			const membershipId = await addMember(club.id, target);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/members/${membershipId}/extend`, {
				duration: "3",
			});
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();
			expect(response.body.membership.endDate).toBeString();

			const newEnd = new Date(response.body.membership.endDate);
			const expected = new Date();
			expected.setMonth(expected.getMonth() + 3);
			// Allow same-day tolerance across the request boundary.
			expect(Math.abs(newEnd.getTime() - expected.getTime())).toBeLessThan(2 * 60 * 60 * 1000);
		});

		test("extending an unknown member returns 404", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(
				`/api/clubs/${club.id}/members/${crypto.randomUUID()}/extend`,
				{
					duration: "1",
				},
			);
			expect(response.status).toBe(404);
		});
	});

	describe("POST /api/clubs/:id/members/leave", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/members/leave`);
			expect(response.status).toBe(401);
		});

		test("a non-member gets 404 when trying to leave", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/members/leave`);
			expect(response.status).toBe(404);
		});

		test("a regular member can leave the club", async () => {
			const owner = await createUser();
			const target = await createUser();
			const club = await createClub(owner);
			await addMember(club.id, target);

			const response = await api(target.cookie).post(`/api/clubs/${club.id}/members/leave`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const membership = await api(target.cookie).get(`/api/clubs/${club.id}/membership`);
			expect(membership.body.isMember).toBeFalse();
		});

		test("the club owner cannot leave their own club", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/members/leave`);
			expect(response.status).toBe(400);
			expect(response.body.error.code).toBeString();
		});
	});

	describe("GET /api/clubs/:id/managers", () => {
		test("unauthenticated request is rejected", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/managers`);
			expect(response.status).toBe(401);
		});

		test("non-manager cannot list managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/managers`);
			expect(response.status).toBe(403);
		});

		test("a manager can list managers and owners, excluding regular members", async () => {
			const owner = await createUser();
			const manager = await createUser();
			const regular = await createUser();
			const club = await createClub(owner);
			await addMember(club.id, manager, "MANAGER");
			await addMember(club.id, regular, "USER");

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/managers`);
			expect(response.status).toBe(200);
			const userIds = response.body.managers.map((m: { userId: string }) => m.userId);
			expect(userIds).toContain(owner.id);
			expect(userIds).toContain(manager.id);
			expect(userIds).not.toContain(regular.id);
		});
	});
});
