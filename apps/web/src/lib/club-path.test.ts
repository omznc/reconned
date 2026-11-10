import { describe, expect, test } from "bun:test";
import { switchClubPath } from "@/lib/club-path";

describe("switchClubPath", () => {
	test("keeps the page of the old club", () => {
		expect(switchClubPath("/dashboard/a", "a", "b")).toBe("/dashboard/b");
		expect(switchClubPath("/dashboard/a/members", "a", "b")).toBe("/dashboard/b/members");
		expect(switchClubPath("/dashboard/a/events/calendar", "a", "b")).toBe("/dashboard/b/events/calendar");
	});

	test("goes to the event list from an event page", () => {
		expect(switchClubPath("/dashboard/a/events/x", "a", "b")).toBe("/dashboard/b/events");
		expect(switchClubPath("/dashboard/a/events/x/attendance", "a", "b")).toBe("/dashboard/b/events");
	});

	test("goes to the club overview from a page outside the club", () => {
		expect(switchClubPath("/dashboard/settings", "a", "b")).toBe("/dashboard/b");
		expect(switchClubPath("/dashboard/ab/members", "a", "b")).toBe("/dashboard/b");
		expect(switchClubPath("/dashboard/a/members", undefined, "b")).toBe("/dashboard/b");
	});
});
