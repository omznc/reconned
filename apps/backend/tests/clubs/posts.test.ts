import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Post Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string };
}

async function createPost(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const response = await api(owner.cookie).post(`/api/clubs/${clubId}/posts`, {
		title: `Test Post ${crypto.randomUUID().slice(0, 8)}`,
		content: "Some content",
		isPublic: true,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.post as { id: string; title: string; isPublic: boolean; images: string[] };
}

describe("club posts", () => {
	describe("GET /clubs/:id/posts", () => {
		test("returns public posts to anonymous callers and hides private club posts", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id, { isPublic: true });

			const anonymous = await api().get(`/api/clubs/${club.id}/posts`);
			expect(anonymous.status).toBe(200);
			expect(anonymous.body.posts.map((p: { id: string }) => p.id)).toContain(post.id);

			const privateClub = await createClub(owner, { isPrivate: true });
			await createPost(owner, privateClub.id, { isPublic: true });
			const outsider = await createUser();
			const hidden = await api(outsider.cookie).get(`/api/clubs/${privateClub.id}/posts`);
			expect(hidden.status).toBe(200);
			expect(hidden.body.posts).toEqual([]);
		});

		test("404s for an unknown club", async () => {
			const response = await api().get(`/api/clubs/${crypto.randomUUID()}/posts`);
			expect(response.status).toBe(404);
		});
	});

	describe("GET /clubs/:id/posts/:postId", () => {
		test("a manager can fetch a specific post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(response.status).toBe(200);
			expect(response.body.post.id).toBe(post.id);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api().get(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(response.status).toBe(403);
		});

		test("404s for an unknown post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/posts/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});

	describe("GET /clubs/:id/posts/paginated", () => {
		test("a manager can list paginated posts", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			await createPost(owner, club.id);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/posts/paginated`);
			expect(response.status).toBe(200);
			expect(response.body.pagination).toMatchObject({ page: 1 });
			expect(Array.isArray(response.body.posts)).toBeTrue();
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/posts/paginated`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/posts/paginated`);
			expect(response.status).toBe(403);
		});
	});

	describe("POST /clubs/:id/posts", () => {
		test("a manager can create a post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/posts`, {
				title: "New Post",
				content: "Body",
				isPublic: true,
			});
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();
			expect(response.body.post.title).toBe("New Post");
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/posts`, {
				title: "New Post",
				content: "Body",
				isPublic: true,
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/posts`, {
				title: "New Post",
				content: "Body",
				isPublic: true,
			});
			expect(response.status).toBe(403);
		});

		test("rejects an empty title", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/posts`, {
				title: "",
				content: "Body",
				isPublic: true,
			});
			expect(response.status).toBe(400);
		});
	});

	describe("PUT /clubs/:id/posts/:postId", () => {
		test("a manager can update a post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/posts/${post.id}`, {
				title: "Updated Title",
				content: "Updated content",
				isPublic: false,
			});
			expect(response.status).toBe(200);
			expect(response.body.post.title).toBe("Updated Title");
			expect(response.body.post.isPublic).toBeFalse();
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api().put(`/api/clubs/${club.id}/posts/${post.id}`, {
				title: "Updated Title",
				content: "Updated content",
				isPublic: false,
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api(outsider.cookie).put(`/api/clubs/${club.id}/posts/${post.id}`, {
				title: "Updated Title",
				content: "Updated content",
				isPublic: false,
			});
			expect(response.status).toBe(403);
		});

		test("404s for an unknown post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/posts/${crypto.randomUUID()}`, {
				title: "Updated Title",
				content: "Updated content",
				isPublic: false,
			});
			expect(response.status).toBe(404);
		});
	});

	describe("DELETE /clubs/:id/posts/:postId", () => {
		test("a manager can delete a post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const fetchAfter = await api(owner.cookie).get(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(fetchAfter.status).toBe(404);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api().delete(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const post = await createPost(owner, club.id);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}/posts/${post.id}`);
			expect(response.status).toBe(403);
		});

		test("404s for an unknown post", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/posts/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});

	describe("POST /clubs/:id/posts/images/upload-url", () => {
		test("a manager can obtain a presigned upload URL", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/posts/images/upload-url`, {
				file: { name: "photo.png", type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(200);
			expect(response.body.url).toBeString();
			expect(response.body.cdnUrl).toBeString();
			expect(response.body.key).toBeString();
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/posts/images/upload-url`, {
				file: { name: "photo.png", type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/posts/images/upload-url`, {
				file: { name: "photo.png", type: "image/png", size: 1024 },
			});
			expect(response.status).toBe(403);
		});
	});
});
