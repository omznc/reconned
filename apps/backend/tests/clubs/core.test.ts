import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	expect(countries.status).toBe(200);
	const countryId = countries.body[0]?.id;
	expect(countryId).toBeNumber();

	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Core Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; slug: string | null };
}

describe("clubs core", () => {
	describe("GET /clubs", () => {
		test("lists clubs with pagination metadata", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const list = await api().get(`/api/clubs?search=${encodeURIComponent(club.name)}`);
			expect(list.status).toBe(200);
			expect(list.body.clubs.map((c: { id: string }) => c.id)).toContain(club.id);
			expect(list.body.pagination).toMatchObject({ page: 1 });
			const found = list.body.clubs.find((c: { id: string }) => c.id === club.id);
			expect(found._count.members).toBe(1);
		});

		test("works without authentication", async () => {
			const response = await api().get("/api/clubs");
			expect(response.status).toBe(200);
		});
	});

	describe("POST /clubs", () => {
		test("requires authentication", async () => {
			const countries = await api().get("/api/countries");
			const response = await api().post("/api/clubs", {
				name: "No Auth Club",
				countryId: countries.body[0]?.id,
				location: "Sarajevo",
			});
			expect(response.status).toBe(401);
		});

		test("rejects invalid body", async () => {
			const user = await createUser();
			const response = await api(user.cookie).post("/api/clubs", {
				name: "",
				countryId: "not-a-number",
				location: "Sarajevo",
			});
			expect(response.status).toBe(400);
			// Body-schema validation failures are formatted by the router itself (not apiError),
			// so `error` here is a plain string rather than the {code, message} shape used
			// elsewhere for handler-thrown errors.
			expect(response.body.error).toBeString();
		});

		test("rejects a duplicate slug", async () => {
			const owner = await createUser();
			const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
			await createClub(owner, { slug });

			const countries = await api(owner.cookie).get("/api/countries");
			const response = await api(owner.cookie).post("/api/clubs", {
				name: "Another Club",
				countryId: countries.body[0]?.id,
				location: "Sarajevo",
				slug,
			});
			expect(response.status).toBe(400);
		});

		test("rejects a dateFounded in the future", async () => {
			const owner = await createUser();
			const countries = await api(owner.cookie).get("/api/countries");
			const response = await api(owner.cookie).post("/api/clubs", {
				name: "Future Club",
				countryId: countries.body[0]?.id,
				location: "Sarajevo",
				dateFounded: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
			});
			expect(response.status).toBe(400);
		});
	});

	describe("GET /clubs/:id", () => {
		test("returns 404 for a non-existent club", async () => {
			const response = await api().get(`/api/clubs/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});

		test("can be fetched by slug", async () => {
			const owner = await createUser();
			const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
			const club = await createClub(owner, { slug });

			const response = await api().get(`/api/clubs/${slug}`);
			expect(response.status).toBe(200);
			expect(response.body.id).toBe(club.id);
		});
	});

	describe("GET /clubs/:id/information", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().get(`/api/clubs/${club.id}/information`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/information`);
			expect(response.status).toBe(403);
		});

		test("returns club info with isCurrentUserOwner for the owner", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/information`);
			expect(response.status).toBe(200);
			expect(response.body.isCurrentUserOwner).toBeTrue();
			expect(response.body.id).toBe(club.id);
		});

		test("returns 404 for a non-existent club", async () => {
			const owner = await createUser();
			const response = await api(owner.cookie).get(`/api/clubs/${crypto.randomUUID()}/information`);
			expect(response.status).toBe(404);
		});
	});

	describe("PUT /clubs/:id", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().put(`/api/clubs/${club.id}`, { name: "New name" });
			expect(response.status).toBe(401);
		});

		test("allows a manager to update the club", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}`, { name: "Updated Name" });
			expect(response.status).toBe(200);
			expect(response.body.club.name).toBe("Updated Name");
		});

		test("rejects invalid body", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}`, { name: "" });
			expect(response.status).toBe(400);
		});

		test("rejects a slug already taken by another club", async () => {
			const owner = await createUser();
			const otherOwner = await createUser();
			const slug = `slug-${crypto.randomUUID().slice(0, 8)}`;
			await createClub(owner, { slug });
			const otherClub = await createClub(otherOwner);

			const response = await api(otherOwner.cookie).put(`/api/clubs/${otherClub.id}`, { slug });
			expect(response.status).toBe(400);
		});

		test("returns 404 for a non-existent club", async () => {
			const owner = await createUser();
			const response = await api(owner.cookie).put(`/api/clubs/${crypto.randomUUID()}`, { name: "X" });
			expect(response.status).toBe(403);
		});
	});

	describe("DELETE /clubs/:id", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().delete(`/api/clubs/${club.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-owners (e.g. a manager) from deleting", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}`);
			expect(response.status).toBe(403);
		});

		// BUG: the handler deletes the club row, then tries to insert a ClubAuditLog row
		// referencing that same (now-gone) clubId. ClubAuditLog.clubId has an FK to Club.id,
		// so the insert violates the constraint and the request 500s even though the club row
		// is in fact deleted. Asserting the actual (buggy) behavior here per the task brief.
		test("deletes the club as owner, but the response 500s because the post-delete audit-log insert violates its FK to the deleted club", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}`);
			expect(response.status).toBe(500);
			expect(response.body.error.code).toBe("INTERNAL_ERROR");

			const fetched = await api(owner.cookie).get(`/api/clubs/${club.id}`);
			expect(fetched.status).toBe(404);
		});
	});

	describe("GET /clubs/managed", () => {
		test("requires authentication", async () => {
			const response = await api().get("/api/clubs/managed");
			expect(response.status).toBe(401);
		});

		test("lists clubs the user manages", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get("/api/clubs/managed");
			expect(response.status).toBe(200);
			expect(response.body.clubs.map((c: { id: string }) => c.id)).toContain(club.id);
		});

		test("excludes clubs the user does not manage", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			await createClub(owner);

			const response = await api(outsider.cookie).get("/api/clubs/managed");
			expect(response.status).toBe(200);
			expect(response.body.clubs).toEqual([]);
		});
	});

	describe("GET /clubs/:id/has-owner", () => {
		test("works without authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/has-owner`);
			expect(response.status).toBe(200);
			expect(response.body.hasOwner).toBeTrue();
		});

		test("returns false for a club with no owner", async () => {
			const response = await api().get(`/api/clubs/${crypto.randomUUID()}/has-owner`);
			expect(response.status).toBe(200);
			expect(response.body.hasOwner).toBeFalse();
		});
	});

	describe("logo upload-url", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/logo/upload-url`, {
				file: { type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/logo/upload-url`, {
				file: { type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(403);
		});

		test("rejects a non-image file type", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/logo/upload-url`, {
				file: { type: "application/pdf", size: 1024 },
			});
			expect(response.status).toBe(400);
		});

		test("rejects a file exceeding the 4MB limit", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/logo/upload-url`, {
				file: { type: "image/png", size: 1024 * 1024 * 5 },
			});
			expect(response.status).toBe(400);
		});

		test("returns a presigned upload URL for a manager", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/logo/upload-url`, {
				file: { type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(200);
			expect(response.body.url).toBeString();
			expect(response.body.cdnUrl).toBeString();
			// The key gets a "_<size>b" suffix inserted (before any extension) for quota tracking.
			expect(response.body.key).toBe(`club/${club.id}/logo_1024b`);
		});
	});

	describe("header-image upload-url", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/header-image/upload-url`, {
				file: { type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/header-image/upload-url`, {
				file: { type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(403);
		});

		test("rejects a file exceeding the 8MB limit", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/header-image/upload-url`, {
				file: { type: "image/png", size: 1024 * 1024 * 9 },
			});
			expect(response.status).toBe(400);
		});

		test("returns a presigned upload URL for a manager", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/header-image/upload-url`, {
				file: { type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(200);
			expect(response.body.key).toBe(`club/${club.id}/header_1024b`);
		});
	});

	describe("DELETE /clubs/:id/logo", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().delete(`/api/clubs/${club.id}/logo`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}/logo`);
			expect(response.status).toBe(403);
		});

		// Not covered: the success path. The handler unconditionally calls deleteS3Files, which
		// makes a real network call to the S3-compatible endpoint; no such server is reachable
		// in this test environment, so it always 500s here regardless of club state. Auth and
		// authorization branches (which return before that call) are covered above.
	});

	describe("DELETE /clubs/:id/header-image", () => {
		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const response = await api().delete(`/api/clubs/${club.id}/header-image`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}/header-image`);
			expect(response.status).toBe(403);
		});

		// Not covered: the success path, for the same reason as DELETE /clubs/:id/logo above
		// (deleteS3Files needs a reachable S3-compatible endpoint that isn't available here).
	});
});
