import { describe, expect, test } from "bun:test";
import { formatTimeRange, takenShare, toDate } from "@/components/redesign/format-event-date";

describe("format-event-date", () => {
	test("reads a zone-less API date as UTC", () => {
		expect(toDate("2026-11-16 22:07:57.963").toISOString()).toBe("2026-11-16T22:07:57.963Z");
		expect(toDate("2026-11-16T22:07:57+02:00").toISOString()).toBe("2026-11-16T20:07:57.000Z");
	});

	test("formats the time range in the site zone", () => {
		expect(formatTimeRange("2026-11-16 07:00:00", "2026-11-16 15:00:00", "en")).toBe("08:00 – 16:00");
		expect(formatTimeRange("2026-11-16 07:00:00", null, "en")).toBe("08:00");
	});

	test("computes the taken share", () => {
		expect(takenShare(30, 60)).toBe(0.5);
		expect(takenShare(0, 0)).toBe(0);
		expect(takenShare(70, 60)).toBe(0);
	});
});
