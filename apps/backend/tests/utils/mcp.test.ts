import { describe, expect, test } from "bun:test";
import { Router } from "@reconned/router";
import * as z from "zod";
import { extractMcpTools, invalidateMcpToolCache } from "../../src/lib/mcp-bridge";
import { alliancesRouter } from "../../src/routes/alliances";
import { clubsRouter } from "../../src/routes/clubs";
import { countriesRouter } from "../../src/routes/countries";
import { eventsRouter } from "../../src/routes/events";
import { publicRouter } from "../../src/routes/public";
import { reviewsRouter } from "../../src/routes/reviews";
import { usersRouter } from "../../src/routes/users";
import { utilsRouter } from "../../src/routes/utils";
import { BASE_URL } from "../helpers/env";

function buildToolNames(): string[] {
	invalidateMcpToolCache();
	const router = new Router();
	for (const sub of [
		countriesRouter,
		usersRouter,
		clubsRouter,
		eventsRouter,
		reviewsRouter,
		utilsRouter,
		publicRouter,
		alliancesRouter,
	]) {
		router.use(sub, "/api");
	}
	const names = extractMcpTools(router).map((tool) => tool.name);
	invalidateMcpToolCache();
	return names;
}

describe("mcp tools", () => {
	test("every exposed tool name is unique", () => {
		const names = buildToolNames();
		const duplicates = names.filter((name, i) => names.indexOf(name) !== i);
		expect(duplicates).toEqual([]);
	});

	test("discovery and reference data are reachable", () => {
		const names = buildToolNames();
		for (const expected of [
			"search",
			"get_review",
			"list_alliances",
			"list_club_alliances",
			"list_cities",
			"get_city",
			"search_cities",
			"get_platform_stats",
			"list_club_posts",
			"list_club_rules",
		]) {
			expect(names).toContain(expected);
		}
	});

	test("a colliding generated name is rejected instead of dropping a route", () => {
		invalidateMcpToolCache();
		const router = new Router();
		// Both generate "get_thing_part" — the path params are dropped from the name.
		router.get("/api/things/:id/parts", ({ response }) => response.json({}), {
			schema: { mcpTool: true, params: z.object({ id: z.string() }) },
		});
		router.get("/api/things/:id/parts/:partId", ({ response }) => response.json({}), {
			schema: { mcpTool: true, params: z.object({ id: z.string(), partId: z.string() }) },
		});
		expect(() => extractMcpTools(router)).toThrow(/Duplicate MCP tool name/);
		invalidateMcpToolCache();
	});
});

describe("mcp", () => {
	test("an unauthenticated MCP request is rejected with 401 and points at the OAuth metadata", async () => {
		const response = await fetch(`${BASE_URL}/api/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
		});
		expect(response.status).toBe(401);
		const body = (await response.json()) as { error?: { code: number; message: string } };
		expect(body.error?.message).toBe("Unauthorized");
		expect(response.headers.get("www-authenticate")).toContain("resource_metadata");
	});

	test("an unsupported HTTP method is rejected with 405", async () => {
		const response = await fetch(`${BASE_URL}/api/mcp`, { method: "DELETE" });
		expect(response.status).toBe(405);
	});
});
