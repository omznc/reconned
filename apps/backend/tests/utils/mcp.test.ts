import { describe, expect, test } from "bun:test";
import { BASE_URL } from "../helpers/env";

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
