import { beforeAll, describe, expect, test } from "bun:test";
import { registrationStateOf, sarajevoMidnight, weekendRange } from "../../src/lib/event-listing";
import { createUser, type TestUser, testDb } from "../helpers/auth";
import { api } from "../helpers/client";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe("event listing helpers", () => {
	const iso = (d: Date) => d.toISOString();

	test("weekend: a Saturday in winter runs from Friday 23:00 UTC to Sunday 23:00 UTC", () => {
		const w = weekendRange(new Date("2026-11-14T10:00:00Z"));
		expect(iso(w.from)).toBe("2026-11-13T23:00:00.000Z");
		expect(iso(w.to)).toBe("2026-11-15T23:00:00.000Z");
	});

	test("weekend: a Saturday in summer uses the +2 offset", () => {
		const w = weekendRange(new Date("2026-07-04T10:00:00Z"));
		expect(iso(w.from)).toBe("2026-07-03T22:00:00.000Z");
		expect(iso(w.to)).toBe("2026-07-05T22:00:00.000Z");
	});

	test("weekend: Sunday 23:30 Sarajevo time is still the same weekend", () => {
		const w = weekendRange(new Date("2026-11-15T22:30:00Z"));
		expect(iso(w.from)).toBe("2026-11-13T23:00:00.000Z");
	});

	test("weekend: Monday 00:30 Sarajevo time is the next weekend", () => {
		const w = weekendRange(new Date("2026-11-15T23:30:00Z"));
		expect(iso(w.from)).toBe("2026-11-20T23:00:00.000Z");
	});

	test("weekend: Friday 23:30 Sarajevo time is the coming weekend, not this one", () => {
		const w = weekendRange(new Date("2026-11-13T22:30:00Z"));
		expect(iso(w.from)).toBe("2026-11-13T23:00:00.000Z");
	});

	test("weekend: the UTC day and the Sarajevo day can differ (Saturday 00:30 local is Friday in UTC)", () => {
		const w = weekendRange(new Date("2026-07-03T22:30:00Z"));
		expect(iso(w.from)).toBe("2026-07-03T22:00:00.000Z");
	});

	test("weekend: the weekend of the spring DST change is 47 hours long", () => {
		const w = weekendRange(new Date("2026-03-28T12:00:00Z"));
		expect(iso(w.from)).toBe("2026-03-27T23:00:00.000Z");
		expect(iso(w.to)).toBe("2026-03-29T22:00:00.000Z");
		expect((w.to.getTime() - w.from.getTime()) / HOUR_MS).toBe(47);
	});

	test("weekend: the weekend of the autumn DST change is 49 hours long", () => {
		const w = weekendRange(new Date("2026-10-25T12:00:00Z"));
		expect(iso(w.from)).toBe("2026-10-23T22:00:00.000Z");
		expect(iso(w.to)).toBe("2026-10-25T23:00:00.000Z");
		expect((w.to.getTime() - w.from.getTime()) / HOUR_MS).toBe(49);
	});

	test("sarajevoMidnight accepts a day that overflows the month", () => {
		expect(iso(sarajevoMidnight(2026, 11, 31))).toBe("2026-11-30T23:00:00.000Z");
	});

	describe("registrationStateOf boundaries", () => {
		const open = "2026-06-10 10:00:00";
		const close = "2026-06-20 10:00:00";
		const e = { dateRegistrationsOpen: open, dateRegistrationsClose: close, maxAttendees: 2 as number | null };
		const at = (s: string) => new Date(s);

		test("one millisecond before opening is notOpenYet", () => {
			expect(registrationStateOf(e, 0, at("2026-06-10T09:59:59.999Z"))).toBe("notOpenYet");
		});

		test("exactly at opening is open", () => {
			expect(registrationStateOf(e, 0, at("2026-06-10T10:00:00.000Z"))).toBe("open");
		});

		test("exactly at closing is still open", () => {
			expect(registrationStateOf(e, 1, at("2026-06-20T10:00:00.000Z"))).toBe("open");
		});

		test("one millisecond after closing is closed", () => {
			expect(registrationStateOf(e, 1, at("2026-06-20T10:00:00.001Z"))).toBe("closed");
		});

		test("headcount one below capacity is open, at capacity is full", () => {
			const now = at("2026-06-15T00:00:00Z");
			expect(registrationStateOf(e, 1, now)).toBe("open");
			expect(registrationStateOf(e, 2, now)).toBe("full");
			expect(registrationStateOf(e, 3, now)).toBe("full");
		});

		test("no capacity is never full", () => {
			expect(registrationStateOf({ ...e, maxAttendees: null }, 9999, at("2026-06-15T00:00:00Z"))).toBe("open");
		});

		test("a full event that has closed is closed, and one that has not opened is notOpenYet", () => {
			expect(registrationStateOf(e, 2, at("2026-07-01T00:00:00Z"))).toBe("closed");
			expect(registrationStateOf(e, 2, at("2026-06-01T00:00:00Z"))).toBe("notOpenYet");
		});
	});
});

interface ListedEvent {
	id: string;
	name: string;
	attendeeCount: number;
	capacity: number | null;
	placesLeft: number | null;
	registrationState: "open" | "notOpenYet" | "closed" | "full";
	price: number;
	currency: string;
	city: string | null;
	countryId: number | null;
	dateStart: string;
	dateEnd: string;
	club: { id: string; slug: string | null; name: string; logo: string | null; verified: boolean } | null;
}

describe("GET /events filters, sorts and facets", () => {
	const token = `lst${crypto.randomUUID().slice(0, 8)}`;
	const now = Date.now();
	const names: Record<string, string> = {};
	const ids: Record<string, string> = {};
	let owner: TestUser;
	let countryA = 0;
	let countryB = 0;
	let clubAId = "";
	let clubBId = "";

	async function createClub(country: number, verified: boolean, city: string) {
		const response = await api(owner.cookie).post("/api/clubs", {
			name: `Listing Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId: country,
			location: city,
		});
		expect(response.status).toBe(200);
		const id = response.body.club.id as string;
		await testDb.unsafe(`UPDATE "Club" SET "verified" = $1, "city" = $2 WHERE "id" = $3`, [verified, city, id]);
		return id;
	}

	async function createEvent(key: string, clubId: string, overrides: Record<string, unknown> = {}) {
		names[key] = `${token} ${key}`;
		const response = await api(owner.cookie).post("/api/events", {
			clubId,
			name: names[key],
			description: "Listing test event",
			costPerPerson: 10,
			location: "Sarajevo",
			dateStart: new Date(now + 7 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 8 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 6 * DAY_MS).toISOString(),
			allowFreelancers: true,
			...overrides,
		});
		expect(response.status).toBe(200);
		ids[key] = response.body.event.id;
	}

	async function list(params: Record<string, string> = {}) {
		const query = new URLSearchParams({ search: token, perPage: "100", ...params });
		const response = await api().get(`/api/events?${query}`);
		expect(response.status).toBe(200);
		return response.body as {
			events: ListedEvent[];
			pagination: { total: number };
			facets?: {
				registration: Record<string, number>;
				country: Array<{ countryId: number; name: string; count: number }>;
			};
			upcomingCount?: number;
			openThisWeekendCount?: number;
		};
	}

	async function keys(params: Record<string, string> = {}) {
		const body = await list(params);
		const byId = new Map(Object.entries(ids).map(([k, v]) => [v, k]));
		return body.events.map((e) => byId.get(e.id) ?? e.name);
	}

	beforeAll(async () => {
		owner = await createUser();
		const countries = await api(owner.cookie).get("/api/countries");
		countryA = countries.body[0].id;
		countryB = countries.body[1].id;
		clubAId = await createClub(countryA, false, "Sarajevo");
		clubBId = await createClub(countryB, true, "Zagreb");

		// Club A: open, price 10, no limit, +7d.
		await createEvent("open", clubAId);
		// Not open yet, free, +9d.
		await createEvent("notYet", clubAId, {
			costPerPerson: 0,
			dateStart: new Date(now + 9 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 10 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now + DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 5 * DAY_MS).toISOString(),
		});
		// Closed, price 20, +3d.
		await createEvent("closed", clubAId, {
			costPerPerson: 20,
			dateStart: new Date(now + 3 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 4 * DAY_MS).toISOString(),
			dateRegistrationsOpen: new Date(now - 3 * DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now - DAY_MS).toISOString(),
		});
		// Full: capacity 1, one confirmed person, +5d, location with a city name.
		await createEvent("full", clubAId, {
			maxAttendees: 1,
			location: `${token}-Mostar`,
			dateStart: new Date(now + 5 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 6 * DAY_MS).toISOString(),
		});
		const attendee = await createUser();
		const registration = await api(attendee.cookie).post(`/api/events/${ids.full}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(registration.status).toBe(200);
		// Club B (verified, other country): capacity 10, price 50, no freelancers, +40d (outside next30).
		await createEvent("verifiedFar", clubBId, {
			maxAttendees: 10,
			costPerPerson: 50,
			allowFreelancers: false,
			dateStart: new Date(now + 40 * DAY_MS).toISOString(),
			dateEnd: new Date(now + 41 * DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(now + 39 * DAY_MS).toISOString(),
		});
	});

	test("list items carry attendee, capacity, state, price, currency, club and location fields", async () => {
		const body = await list();
		const full = body.events.find((e) => e.id === ids.full);
		expect(full).toMatchObject({
			attendeeCount: 1,
			capacity: 1,
			placesLeft: 0,
			registrationState: "full",
			price: 10,
			city: "Sarajevo",
			countryId: countryA,
		});
		expect(typeof full?.currency).toBe("string");
		expect(full?.dateStart).toBeTruthy();
		expect(full?.dateEnd).toBeTruthy();
		expect(full?.club).toMatchObject({ id: clubAId, verified: false });
		expect(full?.club).toHaveProperty("slug");
		expect(full?.club).toHaveProperty("logo");

		const open = body.events.find((e) => e.id === ids.open);
		expect(open).toMatchObject({ attendeeCount: 0, capacity: null, placesLeft: null, registrationState: "open" });
		const far = body.events.find((e) => e.id === ids.verifiedFar);
		expect(far).toMatchObject({ capacity: 10, placesLeft: 10, club: { verified: true } });
	});

	test("registration filter accepts one state, several states, and rejects an unknown state", async () => {
		expect((await keys({ registration: "open" })).sort()).toEqual(["open", "verifiedFar"]);
		expect((await keys({ registration: "notOpenYet" })).sort()).toEqual(["notYet"]);
		expect((await keys({ registration: "closed" })).sort()).toEqual(["closed"]);
		expect((await keys({ registration: "full" })).sort()).toEqual(["full"]);
		expect((await keys({ registration: "closed,full" })).sort()).toEqual(["closed", "full"]);
		const bad = await api().get(`/api/events?search=${token}&registration=nope`);
		expect(bad.status).toBe(400);
	});

	test("countryId filter takes one or several ids", async () => {
		expect((await keys({ countryId: String(countryB) })).sort()).toEqual(["verifiedFar"]);
		expect((await keys({ countryId: String(countryA) })).sort()).toEqual(["closed", "full", "notYet", "open"]);
		expect((await keys({ countryId: `${countryA},${countryB}` })).length).toBe(5);
		expect((await api().get(`/api/events?search=${token}&countryId=abc`)).status).toBe(400);
	});

	test("city filter matches the club city and the event location, case-insensitively", async () => {
		expect((await keys({ city: "zagreb" })).sort()).toEqual(["verifiedFar"]);
		expect((await keys({ city: "mostar" })).sort()).toEqual(["full"]);
	});

	test("maxPrice is inclusive and 0 means free only", async () => {
		expect((await keys({ maxPrice: "0" })).sort()).toEqual(["notYet"]);
		expect((await keys({ maxPrice: "10" })).sort()).toEqual(["full", "notYet", "open"]);
		expect((await keys({ maxPrice: "50" })).length).toBe(5);
	});

	test("freelancers=true keeps only events that allow freelancers", async () => {
		expect((await keys({ freelancers: "true" })).sort()).toEqual(["closed", "full", "notYet", "open"]);
		expect((await keys({ freelancers: "false" })).length).toBe(5);
	});

	test("verifiedOnly=true keeps only events of verified clubs", async () => {
		expect((await keys({ verifiedOnly: "true" })).sort()).toEqual(["verifiedFar"]);
	});

	test("when=next30 keeps events inside the next 30 days", async () => {
		expect((await keys({ when: "next30" })).sort()).toEqual(["closed", "full", "notYet", "open"]);
	});

	test("dateFrom and dateTo are whole Sarajevo calendar days", async () => {
		const day = (offset: number) => new Date(now + offset * DAY_MS).toISOString().slice(0, 10);
		// "open" starts in 7 days. The calendar day in Sarajevo may differ from the UTC day by a few hours, so
		// bracket it with a wide range and then with ranges that must exclude it.
		expect(await keys({ dateFrom: day(6), dateTo: day(8) })).toContain("open");
		expect(await keys({ dateFrom: day(9), dateTo: day(12) })).toEqual(["notYet"]);
		expect(await keys({ dateTo: day(2) })).toEqual([]);
		expect((await api().get("/api/events?dateFrom=2026-13-45")).status).toBe(400);
	});

	test("dateFrom and dateTo use Sarajevo time at the day edge", async () => {
		// 2031-03-14 23:30 UTC is 00:30 on 15 March in Sarajevo.
		const edge = new Date("2031-03-14T23:30:00Z");
		// Must not contain `token`, or the shared search would match it.
		const edgeToken = `edge${crypto.randomUUID().slice(0, 8)}`;
		const response = await api(owner.cookie).post("/api/events", {
			clubId: clubAId,
			name: `${edgeToken} edge`,
			description: "Day edge",
			costPerPerson: 1,
			location: "Sarajevo",
			dateStart: edge.toISOString(),
			dateEnd: new Date(edge.getTime() + 2 * HOUR_MS).toISOString(),
			dateRegistrationsOpen: new Date(edge.getTime() - 5 * DAY_MS).toISOString(),
			dateRegistrationsClose: new Date(edge.getTime() - HOUR_MS).toISOString(),
			allowFreelancers: true,
		});
		expect(response.status).toBe(200);
		const get = async (p: string) =>
			((await api().get(`/api/events?search=${edgeToken}&${p}`)).body.events as unknown[]).length;
		expect(await get("dateFrom=2031-03-15&dateTo=2031-03-15")).toBe(1);
		expect(await get("dateFrom=2031-03-14&dateTo=2031-03-14")).toBe(0);
		expect(await get("dateFrom=2031-03-16")).toBe(0);
	});

	test("when=weekend keeps events inside Saturday 00:00 to Monday 00:00 Sarajevo time", async () => {
		const week = weekendRange(new Date());
		const weekendToken = `wkend${crypto.randomUUID().slice(0, 8)}`;
		const make = async (key: string, start: Date) => {
			const response = await api(owner.cookie).post("/api/events", {
				clubId: clubAId,
				name: `${weekendToken} ${key}`,
				description: "Weekend edge",
				costPerPerson: 1,
				location: "Sarajevo",
				dateStart: start.toISOString(),
				dateEnd: new Date(start.getTime() + 2 * HOUR_MS).toISOString(),
				dateRegistrationsOpen: new Date(start.getTime() - 9 * DAY_MS).toISOString(),
				dateRegistrationsClose: new Date(start.getTime() - HOUR_MS).toISOString(),
				allowFreelancers: true,
			});
			expect(response.status).toBe(200);
		};
		await make("before", new Date(week.from.getTime() - 60_000));
		await make("first", week.from);
		await make("last", new Date(week.to.getTime() - 60_000));
		await make("after", week.to);

		const response = await api().get(`/api/events?search=${weekendToken}&when=weekend&perPage=100`);
		const found = (response.body.events as Array<{ name: string }>).map((e) => e.name.split(" ")[1]).sort();
		expect(found).toEqual(["first", "last"]);
	});

	test("sortBy=date orders by start time in both directions", async () => {
		const asc = await keys({ sortBy: "date", sortOrder: "asc" });
		expect(asc).toEqual(["closed", "full", "open", "notYet", "verifiedFar"]);
		const desc = await keys({ sortBy: "date", sortOrder: "desc" });
		expect(desc).toEqual([...asc].reverse());
		expect(await keys({ sortBy: "dateStart" })).toEqual(asc);
	});

	test("sortBy=price orders by price and breaks ties by start time", async () => {
		expect(await keys({ sortBy: "price", sortOrder: "asc" })).toEqual([
			"notYet",
			"full",
			"open",
			"closed",
			"verifiedFar",
		]);
		const desc = await keys({ sortBy: "price", sortOrder: "desc" });
		expect(desc[0]).toBe("verifiedFar");
		expect(desc[1]).toBe("closed");
	});

	test("sortBy=placesLeft puts the fewest places first and unlimited events last, in both directions", async () => {
		const asc = await keys({ sortBy: "placesLeft", sortOrder: "asc" });
		expect(asc.slice(0, 2)).toEqual(["full", "verifiedFar"]);
		const desc = await keys({ sortBy: "placesLeft", sortOrder: "desc" });
		expect(desc.slice(0, 2)).toEqual(["verifiedFar", "full"]);
		expect(asc.slice(2).sort()).toEqual(["closed", "notYet", "open"]);
		expect(desc.slice(2).sort()).toEqual(["closed", "notYet", "open"]);
	});

	test("sortBy=name sorts by name", async () => {
		expect(await keys({ sortBy: "name", sortOrder: "asc" })).toEqual([
			"closed",
			"full",
			"notYet",
			"open",
			"verifiedFar",
		]);
	});

	test("without a sort the verified club comes first", async () => {
		expect((await keys())[0]).toBe("verifiedFar");
	});

	test("pagination total follows the filters", async () => {
		const body = await list({ registration: "closed,full", perPage: "1" });
		expect(body.pagination.total).toBe(2);
		expect(body.events.length).toBe(1);
	});

	test("facets are absent unless requested", async () => {
		const body = await list();
		expect(body.facets).toBeUndefined();
		expect(body.upcomingCount).toBeUndefined();
	});

	test("registration facet counts every state; its own filter is ignored", async () => {
		const body = await list({ facets: "true", registration: "open" });
		expect(body.facets?.registration).toEqual({ open: 2, notOpenYet: 1, closed: 1, full: 1 });
		expect(body.events.length).toBe(2);
	});

	test("registration facet applies the other filters", async () => {
		const body = await list({ facets: "true", countryId: String(countryA) });
		expect(body.facets?.registration).toEqual({ open: 1, notOpenYet: 1, closed: 1, full: 1 });
		const priced = await list({ facets: "true", maxPrice: "10", registration: "closed" });
		expect(priced.facets?.registration).toEqual({ open: 1, notOpenYet: 1, closed: 0, full: 1 });
	});

	test("country facet counts all countries when only the country filter is set, and applies other filters", async () => {
		const body = await list({ facets: "true", countryId: String(countryB) });
		const byId = Object.fromEntries((body.facets?.country ?? []).map((c) => [c.countryId, c.count]));
		expect(byId[countryA]).toBe(4);
		expect(byId[countryB]).toBe(1);
		expect(body.facets?.country.every((c) => c.name.length > 0)).toBe(true);
		expect(body.events.length).toBe(1);

		const filtered = await list({ facets: "true", registration: "open" });
		const open = Object.fromEntries((filtered.facets?.country ?? []).map((c) => [c.countryId, c.count]));
		expect(open[countryA]).toBe(1);
		expect(open[countryB]).toBe(1);
		// Sorted by count, then name.
		const counts = (body.facets?.country ?? []).map((c) => c.count);
		expect(counts).toEqual([...counts].sort((a, b) => b - a));
	});

	test("facets and listed states agree", async () => {
		const body = await list({ facets: "true" });
		const tally = { open: 0, notOpenYet: 0, closed: 0, full: 0 };
		for (const e of body.events) {
			tally[e.registrationState] += 1;
		}
		expect(body.facets?.registration).toEqual(tally);
	});

	test("header counts ignore the filters and are numbers", async () => {
		const plain = await list({ facets: "true" });
		const filtered = await list({ facets: "true", registration: "full", countryId: String(countryB) });
		expect(typeof plain.upcomingCount).toBe("number");
		expect(typeof plain.openThisWeekendCount).toBe("number");
		expect(filtered.upcomingCount).toBe(plain.upcomingCount ?? -1);
		expect(filtered.openThisWeekendCount).toBe(plain.openThisWeekendCount ?? -1);
		expect(plain.upcomingCount).toBe(5);
	});

	test("openThisWeekendCount counts open events inside the weekend only", async () => {
		const week = weekendRange(new Date());
		const wkToken = `hdr${crypto.randomUUID().slice(0, 8)}`;
		const make = async (key: string, start: Date, open: Date, close: Date) => {
			const response = await api(owner.cookie).post("/api/events", {
				clubId: clubAId,
				name: `${wkToken} ${key}`,
				description: "Header count",
				costPerPerson: 1,
				location: "Sarajevo",
				dateStart: start.toISOString(),
				dateEnd: new Date(start.getTime() + 2 * HOUR_MS).toISOString(),
				dateRegistrationsOpen: open.toISOString(),
				dateRegistrationsClose: close.toISOString(),
				allowFreelancers: true,
			});
			expect(response.status).toBe(200);
		};
		const start = new Date(week.from.getTime() + HOUR_MS);
		const before = (await api().get(`/api/events?search=${wkToken}&facets=true`)).body
			.openThisWeekendCount as number;
		const farPast = new Date(Date.now() - 30 * DAY_MS);
		const farFuture = new Date(Date.now() + 30 * DAY_MS);
		// Open now: counts when the weekend is still ahead or its registration window is still open.
		await make("openNow", start, farPast, new Date(start.getTime() + HOUR_MS));
		// Registration closed already: never counts.
		await make("closedAlready", start, farPast, new Date(Date.now() - HOUR_MS));
		const after = (await api().get(`/api/events?search=${wkToken}&facets=true`)).body
			.openThisWeekendCount as number;
		expect(typeof before).toBe("number");
		expect(farFuture.getTime()).toBeGreaterThan(Date.now());
		const openNowStillOpen = Date.now() <= start.getTime() + HOUR_MS;
		// The search narrows the header counts, so "before" is zero for this unique token.
		expect(after - before).toBe(openNowStillOpen ? 1 : 0);
	});

	test("registering a person busts the cached list", async () => {
		const first = await list();
		expect(first.events.find((e) => e.id === ids.open)?.attendeeCount).toBe(0);
		const attendee = await createUser();
		const registration = await api(attendee.cookie).post(`/api/events/${ids.open}/registrations`, {
			type: "solo",
			paymentMethod: "cash",
		});
		expect(registration.status).toBe(200);
		const second = await list();
		expect(second.events.find((e) => e.id === ids.open)?.attendeeCount).toBe(1);
		// Leave the fixture as it was for the tests that run after this one.
		await api(attendee.cookie).delete(`/api/events/${ids.open}/registrations`);
	});
});

describe("upcoming events and club events carry the same list fields", () => {
	test("GET /events/upcoming has places, state, price, currency and a full club object", async () => {
		const owner = await createUser();
		const countries = await api(owner.cookie).get("/api/countries");
		const created = await api(owner.cookie).post("/api/clubs", {
			name: `Upcoming Club ${crypto.randomUUID().slice(0, 8)}`,
			countryId: countries.body[0].id,
			location: "Sarajevo",
		});
		const clubId = created.body.club.id as string;
		const now = Date.now();
		const make = (name: string, overrides: Record<string, unknown>) =>
			api(owner.cookie).post("/api/events", {
				clubId,
				name,
				description: "Upcoming fields",
				costPerPerson: 15,
				location: "Sarajevo",
				dateStart: new Date(now + 2 * DAY_MS).toISOString(),
				dateEnd: new Date(now + 3 * DAY_MS).toISOString(),
				dateRegistrationsOpen: new Date(now - DAY_MS).toISOString(),
				dateRegistrationsClose: new Date(now + DAY_MS).toISOString(),
				allowFreelancers: true,
				...overrides,
			});
		const created1 = await make(`Upcoming limited ${clubId.slice(0, 6)}`, { maxAttendees: 3 });
		expect(created1.status).toBe(200);
		const eventId = created1.body.event.id as string;
		const attendee = await createUser();
		expect(
			(
				await api(attendee.cookie).post(`/api/events/${eventId}/registrations`, {
					type: "solo",
					paymentMethod: "cash",
				})
			).status,
		).toBe(200);

		const upcoming = await api().get("/api/events/upcoming?limit=100");
		expect(upcoming.status).toBe(200);
		const item = (upcoming.body.events as Array<Record<string, unknown>>).find((e) => e.id === eventId);
		expect(item).toMatchObject({
			attendeeCount: 1,
			capacity: 3,
			placesLeft: 2,
			registrationState: "open",
			price: 15,
			city: null,
			club: { id: clubId, verified: false },
		});
		expect(item?.club).toHaveProperty("logo");
		expect(item?.club).toHaveProperty("slug");
		expect(typeof item?.currency).toBe("string");

		const clubEvents = await api().get(`/api/clubs/${clubId}/events`);
		expect(clubEvents.status).toBe(200);
		expect(clubEvents.body.events[0]).toMatchObject({
			attendeeCount: 1,
			capacity: 3,
			placesLeft: 2,
			registrationState: "open",
			price: 15,
		});
		expect(typeof clubEvents.body.events[0].currency).toBe("string");
	});
});
