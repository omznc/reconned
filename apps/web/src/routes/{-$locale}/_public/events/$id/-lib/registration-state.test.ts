import { describe, expect, test } from "bun:test";
import { registrationState, timelineSteps } from "@/routes/{-$locale}/_public/events/$id/-lib/registration-state";

const window = { dateRegistrationsOpen: "2026-11-01 00:00:00", dateRegistrationsClose: "2026-12-03 23:59:00" };

describe("registrationState", () => {
	test("is pending before the window opens", () => {
		expect(registrationState({ ...window, placesLeft: 5 }, new Date("2026-10-01T00:00:00Z"))).toBe("pending");
	});
	test("is closed after the window", () => {
		expect(registrationState({ ...window, placesLeft: 5 }, new Date("2026-12-04T00:00:00Z"))).toBe("closed");
	});
	test("is open inside the window, also without a limit", () => {
		expect(registrationState({ ...window, placesLeft: null }, new Date("2026-11-09T00:00:00Z"))).toBe("open");
	});
	test("is full inside the window with no places left", () => {
		expect(registrationState({ ...window, placesLeft: 0 }, new Date("2026-11-09T00:00:00Z"))).toBe("full");
	});
});

describe("timelineSteps", () => {
	test("marks only the passed dates as done", () => {
		const steps = timelineSteps({ ...window, dateStart: "2026-12-05 08:00:00" }, new Date("2026-11-09T00:00:00Z"));
		expect(steps.map((step) => step.done)).toEqual([true, false, false]);
	});
});
