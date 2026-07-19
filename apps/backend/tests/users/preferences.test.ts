import { describe, expect, test } from "bun:test";
import { createUser } from "../helpers/auth";
import { api } from "../helpers/client";

describe("PUT /users/:id/theme", () => {
	test("updates the user's theme preference", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}/theme`, { theme: "dark" });
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(user.cookie).get("/api/users/me");
		expect(fetched.body.theme).toBe("dark");
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().put(`/api/users/${user.id}/theme`, { theme: "dark" });
		expect(response.status).toBe(401);
	});

	test("cannot update another user's theme", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).put(`/api/users/${user.id}/theme`, { theme: "dark" });
		expect(response.status).toBe(401);
	});
});

describe("PUT /users/:id/font", () => {
	test("updates the user's font preference", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}/font`, { font: "serif" });
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(user.cookie).get("/api/users/me");
		expect(fetched.body.font).toBe("serif");
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().put(`/api/users/${user.id}/font`, { font: "serif" });
		expect(response.status).toBe(401);
	});

	test("cannot update another user's font", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).put(`/api/users/${user.id}/font`, { font: "serif" });
		expect(response.status).toBe(401);
	});
});

describe("PUT /users/:id/style", () => {
	test("updates the user's style preference", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}/style`, { style: "compact" });
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(user.cookie).get("/api/users/me");
		expect(fetched.body.style).toBe("compact");
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().put(`/api/users/${user.id}/style`, { style: "compact" });
		expect(response.status).toBe(401);
	});

	test("cannot update another user's style", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).put(`/api/users/${user.id}/style`, { style: "compact" });
		expect(response.status).toBe(401);
	});
});

describe("PUT /users/:id/language", () => {
	test("updates the user's language preference", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}/language`, { language: "bs" });
		expect(response.status).toBe(200);
		expect(response.body.success).toBeTrue();

		const fetched = await api(user.cookie).get("/api/users/me");
		expect(fetched.body.language).toBe("bs");
	});

	test("rejects an unsupported language", async () => {
		const user = await createUser();

		const response = await api(user.cookie).put(`/api/users/${user.id}/language`, { language: "fr" });
		expect(response.status).toBe(400);
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().put(`/api/users/${user.id}/language`, { language: "en" });
		expect(response.status).toBe(401);
	});

	test("cannot update another user's language", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).put(`/api/users/${user.id}/language`, { language: "en" });
		expect(response.status).toBe(401);
	});
});

describe("POST /users/:id/image/upload-url", () => {
	test("generates a presigned upload URL for a valid image", async () => {
		const user = await createUser();

		const response = await api(user.cookie).post(`/api/users/${user.id}/image/upload-url`, {
			type: "image/png",
			size: 1024,
		});
		expect(response.status).toBe(200);
		expect(response.body.url).toBeString();
		expect(response.body.cdnUrl).toBeString();
		expect(response.body.key).toBeString();
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().post(`/api/users/${user.id}/image/upload-url`, {
			type: "image/png",
			size: 1024,
		});
		expect(response.status).toBe(401);
	});

	test("cannot request an upload URL for another user", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).post(`/api/users/${user.id}/image/upload-url`, {
			type: "image/png",
			size: 1024,
		});
		expect(response.status).toBe(401);
	});

	test("rejects an unsupported file type with a validation error", async () => {
		const user = await createUser();

		const response = await api(user.cookie).post(`/api/users/${user.id}/image/upload-url`, {
			type: "application/pdf",
			size: 1024,
		});
		expect(response.status).toBe(400);
		expect(response.body.error.code).toBe("VALIDATION_ERROR");
	});
});

describe("POST /users/:id/header-image/upload-url", () => {
	test("generates a presigned upload URL for a valid header image", async () => {
		const user = await createUser();

		const response = await api(user.cookie).post(`/api/users/${user.id}/header-image/upload-url`, {
			type: "image/jpeg",
			size: 2048,
		});
		expect(response.status).toBe(200);
		expect(response.body.url).toBeString();
		expect(response.body.cdnUrl).toBeString();
		expect(response.body.key).toBeString();
	});

	test("requires authentication", async () => {
		const user = await createUser();

		const response = await api().post(`/api/users/${user.id}/header-image/upload-url`, {
			type: "image/jpeg",
			size: 2048,
		});
		expect(response.status).toBe(401);
	});

	test("cannot request an upload URL for another user", async () => {
		const user = await createUser();
		const outsider = await createUser();

		const response = await api(outsider.cookie).post(`/api/users/${user.id}/header-image/upload-url`, {
			type: "image/jpeg",
			size: 2048,
		});
		expect(response.status).toBe(401);
	});
});
