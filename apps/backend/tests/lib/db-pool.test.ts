import { describe, expect, it } from "bun:test";
import { db } from "../../src/lib/db";

describe("db pool", () => {
	// drizzle(url, options) drops the pool options and gives the Bun default (max 10, no idle timeout).
	it("applies the pool options", () => {
		expect(db.$client.options.max).toBe(20);
		// Bun stores the option in ms.
		expect(db.$client.options.idleTimeout).toBe(30_000);
	});
});
