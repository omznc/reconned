import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Review Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string };
}

/** Reviews are gated behind a feature flag and eligibility rules the regular API enforces;
 * inserting directly is simpler and keeps this suite focused on the admin surface. */
async function createReview(author: TestUser, clubId: string) {
	const id = crypto.randomUUID();
	await testDb.unsafe(
		`INSERT INTO "Review" (id, type, rating, content, "authorId", "clubId", "createdAt", "updatedAt")
		 VALUES ('${id}', 'CLUB', 5, 'A great club, seeded directly for testing', '${author.id}', '${clubId}', now(), now())`,
	);
	return id;
}

describe("admin reviews", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/reviews");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/reviews");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can list reviews with their target and delete one", async () => {
		const admin = await makeAdmin(await createUser());
		const author = await createUser();
		const owner = await createUser();
		const club = await createClub(owner);
		const reviewId = await createReview(author, club.id);

		const list = await api(admin.cookie).get("/api/admin/reviews?type=CLUB");
		expect(list.status).toBe(200);
		const found = list.body.reviews.find((r: { id: string }) => r.id === reviewId);
		expect(found).toBeDefined();
		expect(found.target.id).toBe(club.id);
		expect(found.author.id).toBe(author.id);
		expect(found.editCount).toBe(0);
		expect(list.body.pagination).toMatchObject({ page: 1 });

		const del = await api(admin.cookie).delete(`/api/admin/reviews/${reviewId}`);
		expect(del.status).toBe(200);
		expect(del.body.success).toBeTrue();

		const listAfterDelete = await api(admin.cookie).get("/api/admin/reviews?type=CLUB");
		expect(listAfterDelete.body.reviews.map((r: { id: string }) => r.id)).not.toContain(reviewId);
	});

	test("deleting a non-existent review returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).delete(`/api/admin/reviews/${crypto.randomUUID()}`);
		expect(response.status).toBe(404);
		expect(response.body.error.code).toBe("NOT_FOUND");
	});

	test("non-admin cannot delete a review", async () => {
		const user = await createUser();
		const author = await createUser();
		const owner = await createUser();
		const club = await createClub(owner);
		const reviewId = await createReview(author, club.id);

		const response = await api(user.cookie).delete(`/api/admin/reviews/${reviewId}`);
		expect(response.status).toBe(403);
	});
});
