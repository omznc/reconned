import { expect, test } from "bun:test";
import { perPageFor, toEventsQuery } from "@/routes/{-$locale}/_public/events/-components/events-search";

test("a bad value falls back to its default", () => {
	const query = toEventsQuery({ sort: "nope", page: "-3", reg: "open,bogus", country: "278,x", from: "tomorrow" });
	expect(query.sort).toBe("soonest");
	expect(query.page).toBe(1);
	expect(query.registration).toEqual(["open"]);
	expect(query.countryId).toEqual([278]);
	expect(query.dateFrom).toBeUndefined();
});

test("a valid search keeps its values", () => {
	const query = toEventsQuery({ when: "weekend", maxPrice: "20", freelancers: "true", from: "2026-11-14" });
	expect(query).toMatchObject({ when: "weekend", maxPrice: 20, freelancers: true, dateFrom: "2026-11-14" });
});

test("load more asks for more events, up to the backend limit", () => {
	expect(perPageFor(1)).toBe(12);
	expect(perPageFor(3)).toBe(36);
	expect(perPageFor(50)).toBe(100);
});
