import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser) {
	const countries = await api(owner.cookie).get("/api/countries");
	const countryId = countries.body[0]?.id;
	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Purchase Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string };
}

async function createPurchase(owner: TestUser, clubId: string, overrides: Record<string, unknown> = {}) {
	const response = await api(owner.cookie).post(`/api/clubs/${clubId}/purchases`, {
		title: `Purchase ${crypto.randomUUID().slice(0, 8)}`,
		amount: 42.5,
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.purchase as { id: string; title: string; amount: number };
}

describe("club purchases", () => {
	describe("GET /clubs/:id/purchases", () => {
		test("a manager can list paginated purchases", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/purchases`);
			expect(response.status).toBe(200);
			expect(response.body.purchases.map((p: { id: string }) => p.id)).toContain(purchase.id);
			expect(response.body.pagination).toMatchObject({ page: 1 });
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().get(`/api/clubs/${club.id}/purchases`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/purchases`);
			expect(response.status).toBe(403);
		});
	});

	describe("GET /clubs/:id/purchases/:purchaseId", () => {
		test("a manager can fetch a specific purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(response.status).toBe(200);
			expect(response.body.purchase.id).toBe(purchase.id);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api().get(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(outsider.cookie).get(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(response.status).toBe(403);
		});

		test("404s for an unknown purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).get(`/api/clubs/${club.id}/purchases/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});

	describe("POST /clubs/:id/purchases", () => {
		test("a manager can create a purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/purchases`, {
				title: "New Purchase",
				description: "Gear",
				amount: 99.99,
			});
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();
			expect(response.body.purchase.title).toBe("New Purchase");
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/purchases`, {
				title: "New Purchase",
				amount: 10,
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/purchases`, {
				title: "New Purchase",
				amount: 10,
			});
			expect(response.status).toBe(403);
		});

		test("rejects an amount below the minimum", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/purchases`, {
				title: "Too cheap",
				amount: 0,
			});
			expect(response.status).toBe(400);
		});

		test("rejects more than three receipts", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/purchases`, {
				title: "Too many receipts",
				amount: 10,
				receiptUrls: [
					"https://example.com/r1.png",
					"https://example.com/r2.png",
					"https://example.com/r3.png",
					"https://example.com/r4.png",
				],
			});
			expect(response.status).toBe(400);
		});
	});

	describe("PUT /clubs/:id/purchases/:purchaseId", () => {
		test("a manager can update a purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/purchases/${purchase.id}`, {
				title: "Updated Purchase",
				amount: 15,
			});
			expect(response.status).toBe(200);
			expect(response.body.purchase.title).toBe("Updated Purchase");
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api().put(`/api/clubs/${club.id}/purchases/${purchase.id}`, {
				title: "Updated Purchase",
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(outsider.cookie).put(`/api/clubs/${club.id}/purchases/${purchase.id}`, {
				title: "Updated Purchase",
			});
			expect(response.status).toBe(403);
		});

		test("404s for an unknown purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/purchases/${crypto.randomUUID()}`, {
				title: "Updated Purchase",
			});
			expect(response.status).toBe(404);
		});

		test("rejects more than three receipts", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(owner.cookie).put(`/api/clubs/${club.id}/purchases/${purchase.id}`, {
				receiptUrls: [
					"https://example.com/r1.png",
					"https://example.com/r2.png",
					"https://example.com/r3.png",
					"https://example.com/r4.png",
				],
			});
			expect(response.status).toBe(400);
		});
	});

	describe("DELETE /clubs/:id/purchases/:purchaseId", () => {
		test("a manager can delete a purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(response.status).toBe(200);
			expect(response.body.success).toBeTrue();

			const fetchAfter = await api(owner.cookie).get(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(fetchAfter.status).toBe(404);
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api().delete(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);
			const purchase = await createPurchase(owner, club.id);

			const response = await api(outsider.cookie).delete(`/api/clubs/${club.id}/purchases/${purchase.id}`);
			expect(response.status).toBe(403);
		});

		test("404s for an unknown purchase", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).delete(`/api/clubs/${club.id}/purchases/${crypto.randomUUID()}`);
			expect(response.status).toBe(404);
		});
	});

	describe("POST /clubs/:id/purchases/receipts/upload-url", () => {
		test("a manager can obtain a presigned upload URL", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api(owner.cookie).post(`/api/clubs/${club.id}/purchases/receipts/upload-url`, {
				file: { name: "receipt.png", type: "image/png", size: 2048 },
			});
			expect(response.status).toBe(200);
			expect(response.body.url).toBeString();
			expect(response.body.cdnUrl).toBeString();
			expect(response.body.key).toBeString();
		});

		test("requires authentication", async () => {
			const owner = await createUser();
			const club = await createClub(owner);

			const response = await api().post(`/api/clubs/${club.id}/purchases/receipts/upload-url`, {
				file: { name: "receipt.png", type: "image/png", size: 2048 },
			});
			expect(response.status).toBe(401);
		});

		test("forbids non-managers", async () => {
			const owner = await createUser();
			const outsider = await createUser();
			const club = await createClub(owner);

			const response = await api(outsider.cookie).post(`/api/clubs/${club.id}/purchases/receipts/upload-url`, {
				file: { name: "receipt.png", type: "image/png", size: 2048 },
			});
			expect(response.status).toBe(403);
		});
	});
});
