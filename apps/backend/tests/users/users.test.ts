import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

describe("GET /users/:id", () => {
	test("returns a user's public profile with memberships and registrations", async () => {
		const user = await createUser();

		const response = await api().get(`/api/users/${user.id}`);
		expect(response.status).toBe(200);
		expect(response.body.id).toBe(user.id);
		expect(response.body.name).toBe(user.name);
		expect(response.body.clubMembership).toBeArray();
		expect(response.body.eventRegistration).toBeArray();
	});

	test("returns 404 for a non-existent user", async () => {
		const response = await api().get("/api/users/does-not-exist");
		expect(response.status).toBe(404);
		expect(response.body.error.code).toBeString();
	});

	test("a private user is hidden from anonymous and other users, visible to self", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		await api(owner.cookie).put(`/api/users/${owner.id}`, { isPrivate: true });

		const anonymous = await api().get(`/api/users/${owner.id}`);
		expect(anonymous.status).toBe(404);

		const asOutsider = await api(outsider.cookie).get(`/api/users/${owner.id}`);
		expect(asOutsider.status).toBe(404);

		const asSelf = await api(owner.cookie).get(`/api/users/${owner.id}`);
		expect(asSelf.status).toBe(200);
		expect(asSelf.body.id).toBe(owner.id);
	});
});

describe("GET /users/me", () => {
	test("returns the authenticated user's full profile", async () => {
		const user = await createUser();

		const response = await api(user.cookie).get("/api/users/me");
		expect(response.status).toBe(200);
		expect(response.body.id).toBe(user.id);
		expect(response.body.email).toBe(user.email);
	});

	test("requires authentication", async () => {
		const response = await api().get("/api/users/me");
		expect(response.status).toBe(401);
	});
});

describe("GET /users", () => {
	test("lists users and supports search", async () => {
		const user = await createUser();

		const response = await api().get(`/api/users?search=${encodeURIComponent(user.name)}`);
		expect(response.status).toBe(200);
		const ids = response.body.users.map((u: { id: string }) => u.id);
		expect(ids).toContain(user.id);
		expect(response.body.pagination).toMatchObject({ page: 1 });
	});

	test("excludes other people's private profiles from anonymous listings", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		await api(owner.cookie).put(`/api/users/${owner.id}`, { isPrivate: true });

		const response = await api(outsider.cookie).get(`/api/users?search=${encodeURIComponent(owner.name)}`);
		expect(response.status).toBe(200);
		const ids = response.body.users.map((u: { id: string }) => u.id);
		expect(ids).not.toContain(owner.id);
	});
});

describe("GET /users/:id/profile", () => {
	test("returns a public profile view", async () => {
		const user = await createUser();

		const response = await api().get(`/api/users/${user.id}/profile`);
		expect(response.status).toBe(200);
		expect(response.body.id).toBe(user.id);
	});

	test("returns 404 for a non-existent user", async () => {
		const response = await api().get("/api/users/does-not-exist/profile");
		expect(response.status).toBe(404);
	});

	test("returns 404 for a private user's profile", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		await api(owner.cookie).put(`/api/users/${owner.id}`, { isPrivate: true });

		const response = await api(outsider.cookie).get(`/api/users/${owner.id}/profile`);
		expect(response.status).toBe(404);
	});
});

describe("PUT /users/:id", () => {
	test("updates the authenticated user's own profile", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}`, {
			bio: "Updated bio",
			location: "Mostar",
		});
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(user.cookie).get(`/api/users/${user.id}`);
		expect(fetched.body.bio).toBe("Updated bio");
		expect(fetched.body.location).toBe("Mostar");
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().put(`/api/users/${user.id}`, { bio: "Hijacked" });
		expect(response.status).toBe(401);
	});

	test("cannot update another user's profile", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).put(`/api/users/${user.id}`, { bio: "Hijacked" });
		expect(response.status).toBe(401);

		const unchanged = await api(user.cookie).get(`/api/users/${user.id}`);
		expect(unchanged.body.bio).not.toBe("Hijacked");
	});

	test("rejects a bio exceeding the max length", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}`, { bio: "a".repeat(201) });
		expect(response.status).toBe(400);
	});

	test("rejects a slug that is already taken", async () => {
		const first = await createUser();
		const second = await createUser();
		const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;

		const claimed = await api(first.cookie).put(`/api/users/${first.id}`, { slug });
		expect(claimed.status).toBe(200);

		const conflict = await api(second.cookie).put(`/api/users/${second.id}`, { slug });
		expect(conflict.status).toBe(400);
	});
});

describe("DELETE /users/:id/image and /users/:id/header-image", () => {
	test("clears the user's image", async () => {
		const user = await createUser();
		await api(user.cookie).put(`/api/users/${user.id}`, { image: "https://example.com/avatar.png" });

		const response = await api(user.cookie).delete(`/api/users/${user.id}/image`);
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(user.cookie).get("/api/users/me");
		expect(fetched.body.image).toBeNull();
	});

	test("clearing image requires authentication as the owner", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const unauth = await api().delete(`/api/users/${user.id}/image`);
		expect(unauth.status).toBe(401);

		const forbidden = await api(outsider.cookie).delete(`/api/users/${user.id}/image`);
		expect(forbidden.status).toBe(401);
	});

	test("clears the user's header image", async () => {
		const user = await createUser();

		const response = await api(user.cookie).delete(`/api/users/${user.id}/header-image`);
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();
	});
});

describe("GET /users/:id/stats", () => {
	test("returns aggregated stats for a user", async () => {
		const user = await createUser();

		const response = await api().get(`/api/users/${user.id}/stats`);
		expect(response.status).toBe(200);
		expect(response.body.eventRegistration).toBeNumber();
		expect(response.body.clubMembership).toBeNumber();
		expect(response.body.clubMembershipDetails).toBeArray();
		expect(response.body.eventRegistrationDetails).toBeArray();
	});

	test("returns 404 when stats are private and requester is not self/admin", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		await api(owner.cookie).put(`/api/users/${owner.id}`, { isPrivateStats: true });

		const asOutsider = await api(outsider.cookie).get(`/api/users/${owner.id}/stats`);
		expect(asOutsider.status).toBe(404);

		const asSelf = await api(owner.cookie).get(`/api/users/${owner.id}/stats`);
		expect(asSelf.status).toBe(200);
	});

	test("returns 404 for a non-existent user", async () => {
		const response = await api().get("/api/users/does-not-exist/stats");
		expect(response.status).toBe(404);
	});
});

describe("GET /users/:id/account", () => {
	test("returns whether the user has a password set", async () => {
		const user = await createUser();

		const response = await api(user.cookie).get(`/api/users/${user.id}/account`);
		expect(response.status).toBe(200);
		expect(response.body.hasPassword).toBeTrue();
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().get(`/api/users/${user.id}/account`);
		expect(response.status).toBe(401);
	});

	test("another non-admin user cannot view someone else's account info", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).get(`/api/users/${user.id}/account`);
		expect(response.status).toBe(401);
	});
});

describe("GET /users/invites and /users/invites/count", () => {
	test("returns an empty invite list and zero count when there are none", async () => {
		const user = await createUser();

		const invites = await api(user.cookie).get("/api/users/invites");
		expect(invites.status).toBe(200);
		expect(invites.body.invites).toBeArray();

		const count = await api(user.cookie).get("/api/users/invites/count");
		expect(count.status).toBe(200);
		expect(count.body.count).toBeNumber();
	});

	test("require authentication", async () => {
		const invites = await api().get("/api/users/invites");
		expect(invites.status).toBe(401);

		const count = await api().get("/api/users/invites/count");
		expect(count.status).toBe(401);
	});
});

describe("GET /users/:id/daily-quota", () => {
	test("returns quota usage for the authenticated user", async () => {
		const user = await createUser();

		const response = await api(user.cookie).get(`/api/users/${user.id}/daily-quota`);
		expect(response.status).toBe(200);
		expect(response.body.limit).toBeNumber();
		expect(response.body.allowed).toBeTrue();
	});

	test("cannot view another user's daily quota", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).get(`/api/users/${user.id}/daily-quota`);
		expect(response.status).toBe(401);
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().get(`/api/users/${user.id}/daily-quota`);
		expect(response.status).toBe(401);
	});
});

describe("GET /users/me/clubs", () => {
	async function createClub(owner: TestUser) {
		const countries = await api(owner.cookie).get("/api/countries");
		const countryId = countries.body[0]?.id;
		const response = await api(owner.cookie).post("/api/clubs", {
			name: `Test Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId,
			location: "Sarajevo",
		});
		expect(response.status).toBe(200);
		return response.body.club as { id: string };
	}

	test("returns the clubs the authenticated user belongs to", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const response = await api(owner.cookie).get("/api/users/me/clubs");
		expect(response.status).toBe(200);
		const ids = response.body.clubs.map((c: { id: string }) => c.id);
		expect(ids).toContain(club.id);
	});

	test("requires authentication", async () => {
		const response = await api().get("/api/users/me/clubs");
		expect(response.status).toBe(401);
	});
});

describe("POST /users/:id/delete", () => {
	test("deletes the authenticated user's own account", async () => {
		const user = await createUser();

		const response = await api(user.cookie).post(`/api/users/${user.id}/delete`, {
			password: user.password,
		});
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api().get(`/api/users/${user.id}`);
		expect(fetched.status).toBe(404);
	});

	test("requires the correct password when one is set", async () => {
		const user = await createUser();

		// better-auth's verifyPassword throws its own APIError (400) for a wrong password
		// before the route's own apiError.unauthorized() check is ever reached.
		const wrongPassword = await api(user.cookie).post(`/api/users/${user.id}/delete`, {
			password: "definitely-wrong",
		});
		expect(wrongPassword.status).toBe(400);

		const missingPassword = await api(user.cookie).post(`/api/users/${user.id}/delete`, {});
		expect(missingPassword.status).toBe(400);
	});

	test("cannot delete another user's account", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).post(`/api/users/${user.id}/delete`, {
			password: outsider.password,
		});
		expect(response.status).toBe(401);
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().post(`/api/users/${user.id}/delete`, { password: user.password });
		expect(response.status).toBe(401);
	});
});
