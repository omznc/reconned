import { describe, expect, test } from "bun:test";
import { createUser, type TestUser } from "../helpers/auth";
import { api } from "../helpers/client";

async function createClub(owner: TestUser, overrides: Record<string, unknown> = {}) {
	const countries = await api(owner.cookie).get("/api/countries");
	expect(countries.status).toBe(200);
	const countryId = countries.body[0]?.id;
	expect(countryId).toBeNumber();

	const response = await api(owner.cookie).post("/api/clubs", {
		name: `Test Club ${crypto.randomUUID().slice(0, 8)}`,
		countryId,
		location: "Sarajevo",
		...overrides,
	});
	expect(response.status).toBe(200);
	return response.body.club as { id: string; name: string; isPrivate: boolean };
}

describe("clubs", () => {
	test("creating a club makes the creator its owner", async () => {
		const owner = await createUser();
		const club = await createClub(owner);

		const information = await api(owner.cookie).get(`/api/clubs/${club.id}/information`);
		expect(information.status).toBe(200);
		expect(information.body.isCurrentUserOwner).toBeTrue();
	});

	test("a non-member cannot update someone else's club", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner);

		const response = await api(outsider.cookie).put(`/api/clubs/${club.id}`, { name: "Hijacked" });
		expect(response.status).toBe(403);
		expect(response.body.error.code).toBeString();
		expect(response.body.error.message).toBeString();

		const unchanged = await api(owner.cookie).get(`/api/clubs/${club.id}`);
		expect(unchanged.body.name).toBe(club.name);
	});

	test("a private club is hidden from non-members but visible to members", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner, { isPrivate: true });

		const asOutsider = await api(outsider.cookie).get(`/api/clubs/${club.id}`);
		expect(asOutsider.status).toBe(404);

		const anonymous = await api().get(`/api/clubs/${club.id}`);
		expect(anonymous.status).toBe(404);

		const asOwner = await api(owner.cookie).get(`/api/clubs/${club.id}`);
		expect(asOwner.status).toBe(200);
		expect(asOwner.body.id).toBe(club.id);
	});

	test("the public club list excludes other people's private clubs", async () => {
		const owner = await createUser();
		const outsider = await createUser();
		const club = await createClub(owner, { isPrivate: true });

		const list = await api(outsider.cookie).get(`/api/clubs?search=${encodeURIComponent(club.name)}`);
		expect(list.status).toBe(200);
		const ids = list.body.clubs?.map((c: { id: string }) => c.id) ?? [];
		expect(ids).not.toContain(club.id);
	});
});
