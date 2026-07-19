import { describe, expect, test } from "bun:test";
import { createUser, makeAdmin, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createUnclaimedClub(admin: TestUser, overrides: Record<string, unknown> = {}) {
	const response = await api(admin.cookie).post("/api/admin/unclaimed-clubs", {
		name: `Unclaimed Club ${crypto.randomUUID().slice(0, 8)}`,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body as { id: string; club: { id: string; name: string } };
}

describe("admin unclaimed clubs", () => {
	test("unauthenticated requests are rejected with 401", async () => {
		const list = await api().get("/api/admin/unclaimed-clubs");
		expect(list.status).toBe(401);
		expect(list.body.error).toBe("Authentication required");
	});

	test("non-admin requests are rejected with 403", async () => {
		const user = await createUser();
		const list = await api(user.cookie).get("/api/admin/unclaimed-clubs");
		expect(list.status).toBe(403);
		expect(list.body.error).toBe("Insufficient permissions");
	});

	test("admin can create, list, get and update an unclaimed club", async () => {
		const admin = await makeAdmin(await createUser());
		const created = await createUnclaimedClub(admin);

		const list = await api(admin.cookie).get(
			`/api/admin/unclaimed-clubs?search=${encodeURIComponent(created.club.name)}`,
		);
		expect(list.status).toBe(200);
		expect(list.body.clubs.map((c: { id: string }) => c.id)).toContain(created.id);
		expect(list.body.clubs[0]._count).toBeDefined();
		expect(list.body.pagination).toMatchObject({ page: 1 });

		const get = await api(admin.cookie).get(`/api/admin/unclaimed-clubs/${created.id}`);
		expect(get.status).toBe(200);
		expect(get.body.id).toBe(created.id);
		expect(get.body._count.members).toBe(0);

		const updated = await api(admin.cookie).put(`/api/admin/unclaimed-clubs/${created.id}`, {
			name: "Updated Unclaimed Name",
		});
		expect(updated.status).toBe(200);
		expect(updated.body.success).toBeTrue();

		const getAfterUpdate = await api(admin.cookie).get(`/api/admin/unclaimed-clubs/${created.id}`);
		expect(getAfterUpdate.body.name).toBe("Updated Unclaimed Name");
	});

	test("creating an unclaimed club without a name fails validation", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).post("/api/admin/unclaimed-clubs", {});
		expect(response.status).toBe(400);
	});

	test("getting a non-existent unclaimed club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).get("/api/admin/unclaimed-clubs/does-not-exist");
		expect(response.status).toBe(404);
	});

	test("updating a non-existent unclaimed club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).put("/api/admin/unclaimed-clubs/does-not-exist", {
			name: "Whatever",
		});
		expect(response.status).toBe(404);
	});

	test("admin can update the logo and header image of an unclaimed club", async () => {
		const admin = await makeAdmin(await createUser());
		const created = await createUnclaimedClub(admin);

		const logo = await api(admin.cookie).put(`/api/admin/unclaimed-clubs/${created.id}/logo`, {
			logo: "https://example.com/logo.png",
		});
		expect(logo.status).toBe(200);
		expect(logo.body.success).toBeTrue();

		const header = await api(admin.cookie).put(`/api/admin/unclaimed-clubs/${created.id}/header-image`, {
			headerImage: "https://example.com/header.png",
		});
		expect(header.status).toBe(200);
		expect(header.body.success).toBeTrue();
	});

	test("updating the logo of a non-existent unclaimed club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const response = await api(admin.cookie).put("/api/admin/unclaimed-clubs/does-not-exist/logo", {
			logo: "https://example.com/logo.png",
		});
		expect(response.status).toBe(404);
	});

	test("admin can request a presigned upload URL for the logo and header image", async () => {
		const admin = await makeAdmin(await createUser());
		const created = await createUnclaimedClub(admin);

		const logoUpload = await api(admin.cookie).post(`/api/admin/unclaimed-clubs/${created.id}/logo/upload-url`, {
			file: { type: "image/png", size: 1024 },
		});
		expect(logoUpload.status).toBe(200);
		expect(logoUpload.body.url).toBeString();
		expect(logoUpload.body.cdnUrl).toBeString();
		expect(logoUpload.body.key).toBeString();

		const headerUpload = await api(admin.cookie).post(
			`/api/admin/unclaimed-clubs/${created.id}/header-image/upload-url`,
			{ file: { type: "image/jpeg", size: 2048 } },
		);
		expect(headerUpload.status).toBe(200);
		expect(headerUpload.body.url).toBeString();
	});

	test("the upload URL endpoints 404 for a club that does not exist", async () => {
		const admin = await makeAdmin(await createUser());
		const logoResponse = await api(admin.cookie).post("/api/admin/unclaimed-clubs/does-not-exist/logo/upload-url", {
			file: { type: "image/png", size: 1024 },
		});
		expect(logoResponse.status).toBe(404);

		const headerResponse = await api(admin.cookie).post(
			"/api/admin/unclaimed-clubs/does-not-exist/header-image/upload-url",
			{ file: { type: "image/jpeg", size: 1024 } },
		);
		expect(headerResponse.status).toBe(404);
	});

	test("requesting an upload URL with an invalid file size fails validation", async () => {
		const admin = await makeAdmin(await createUser());
		const created = await createUnclaimedClub(admin);

		const response = await api(admin.cookie).post(`/api/admin/unclaimed-clubs/${created.id}/logo/upload-url`, {
			file: { type: "image/png", size: 0 },
		});
		expect(response.status).toBe(400);
	});

	test("admin can assign an owner to an unclaimed club", async () => {
		const admin = await makeAdmin(await createUser());
		const created = await createUnclaimedClub(admin);
		const futureOwner = await createUser();

		const assign = await api(admin.cookie).post(`/api/admin/unclaimed-clubs/${created.id}/assign-owner`, {
			userId: futureOwner.id,
		});
		expect(assign.status).toBe(200);
		expect(assign.body.success).toBeTrue();

		// Once owned, the club is no longer "unclaimed" and admin/clubs/:id should now find it.
		const adminClubGet = await api(admin.cookie).get(`/api/admin/clubs/${created.id}`);
		expect(adminClubGet.status).toBe(200);
	});

	test("assigning an owner twice fails validation the second time", async () => {
		const admin = await makeAdmin(await createUser());
		const created = await createUnclaimedClub(admin);
		const firstOwner = await createUser();
		const secondOwner = await createUser();

		const first = await api(admin.cookie).post(`/api/admin/unclaimed-clubs/${created.id}/assign-owner`, {
			userId: firstOwner.id,
		});
		expect(first.status).toBe(200);

		const second = await api(admin.cookie).post(`/api/admin/unclaimed-clubs/${created.id}/assign-owner`, {
			userId: secondOwner.id,
		});
		expect(second.status).toBe(400);
	});

	test("assigning an owner to a non-existent club returns 404", async () => {
		const admin = await makeAdmin(await createUser());
		const user = await createUser();

		const response = await api(admin.cookie).post("/api/admin/unclaimed-clubs/does-not-exist/assign-owner", {
			userId: user.id,
		});
		expect(response.status).toBe(404);
	});

	test("non-admin cannot create an unclaimed club", async () => {
		const user = await createUser();
		const response = await api(user.cookie).post("/api/admin/unclaimed-clubs", {
			name: "Should Not Be Created",
		});
		expect(response.status).toBe(403);
	});
});
