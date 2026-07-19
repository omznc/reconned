import { describe, expect, test } from "bun:test";
import { api } from "../helpers/client";

describe("countries", () => {
	test("returns enabled countries with expected shape, anonymously", async () => {
		const response = await api().get("/api/countries");
		expect(response.status).toBe(200);
		expect(Array.isArray(response.body)).toBeTrue();
		expect(response.body.length).toBeGreaterThan(0);

		const country = response.body[0];
		expect(country.id).toBeNumber();
		expect(country.name).toBeString();
		expect(country.iso2).toBeString();
	});

	test("is cached: repeated calls return the same data", async () => {
		const first = await api().get("/api/countries");
		const second = await api().get("/api/countries");
		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(second.body).toEqual(first.body);
	});

	test("sets a public cache-control header", async () => {
		const response = await api().get("/api/countries");
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("public");
	});
});
