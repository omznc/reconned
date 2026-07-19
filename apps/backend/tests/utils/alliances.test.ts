import { describe, expect, test } from "bun:test";
import { api } from "../helpers/client";

describe("alliances", () => {
	test("returns alliances for a valid country id, anonymously", async () => {
		const countries = await api().get("/api/countries");
		expect(countries.status).toBe(200);
		const countryId = countries.body[0]?.id;
		expect(countryId).toBeNumber();

		const response = await api().get(`/api/alliances/${countryId}`);
		expect(response.status).toBe(200);
		expect(Array.isArray(response.body.alliances)).toBeTrue();
		for (const alliance of response.body.alliances) {
			expect(alliance.countryId).toBe(countryId);
		}
	});

	test("returns an empty list for a country with no alliances", async () => {
		// A very large id that will not correspond to a seeded country/alliance.
		const response = await api().get("/api/alliances/999999");
		expect(response.status).toBe(200);
		expect(response.body.alliances).toEqual([]);
	});

	test("rejects a non-numeric country id with 400", async () => {
		const response = await api().get("/api/alliances/not-a-number");
		expect(response.status).toBe(400);
	});

	test("rejects a zero country id with 400", async () => {
		const response = await api().get("/api/alliances/0");
		expect(response.status).toBe(400);
	});
});
