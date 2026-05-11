import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Router } from "@reconned/router";
import { auth } from "../lib/auth";
import { executeMcpTool, extractMcpTools, isWriteTool } from "../lib/mcp-bridge";

const MAX_REQUESTS = 300;
const MAX_WRITES = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const mcpRateLimits = new Map<string, RateLimitEntry>();
const mcpWriteRateLimits = new Map<string, RateLimitEntry>();

setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of mcpRateLimits) {
		if (now > entry.resetAt) mcpRateLimits.delete(key);
	}
	for (const [key, entry] of mcpWriteRateLimits) {
		if (now > entry.resetAt) mcpWriteRateLimits.delete(key);
	}
}, 60_000).unref();

function checkRateLimit(map: Map<string, RateLimitEntry>, key: string, max: number): boolean {
	const now = Date.now();
	const entry = map.get(key);
	if (entry) {
		if (now > entry.resetAt) {
			map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
			return true;
		}
		if (entry.count >= max) return false;
		entry.count++;
		return true;
	}
	map.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
	return true;
}

export async function handleMCPRequest(request: Request, router: Router): Promise<Response> {
	const url = new URL(request.url);
	if (url.pathname !== "/api/mcp") return new Response("Not Found", { status: 404 });
	if (request.method !== "POST" && request.method !== "GET")
		return new Response("Method Not Allowed", { status: 405 });

	const headers = new Headers(request.headers);
	const apiKey = headers.get("X-API-Key");
	if (apiKey && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${apiKey}`);
	const authHeader = headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ") && !headers.has("X-API-Key")) headers.set("X-API-Key", authHeader.slice(7));

	try {
		const session = await auth.api.getSession({ headers });
		if (!session?.user) {
			return new Response(
				JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }),
				{ status: 401, headers: { "Content-Type": "application/json" } },
			);
		}
		const userId = session.user.id;
		if (!checkRateLimit(mcpRateLimits, userId, MAX_REQUESTS)) {
			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					error: {
						code: -32002,
						message: `Rate limit exceeded. Limited to ${MAX_REQUESTS} requests/minute.`,
					},
					id: null,
				}),
				{ status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } },
			);
		}

		const server = new Server({ name: "reconned-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

		server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: extractMcpTools(router) }));

		server.setRequestHandler(CallToolRequestSchema, async (req) => {
			const { name, arguments: args } = req.params;
			if (isWriteTool(name, router) && !checkRateLimit(mcpWriteRateLimits, userId, MAX_WRITES)) {
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								error: `Write rate limit exceeded. Limited to ${MAX_WRITES} writes per minute.`,
							}),
						},
					],
					isError: true,
				};
			}
			return executeMcpTool(
				name,
				args ?? {},
				{
					id: userId,
					email: session.user.email,
					name: session.user.name,
					role: (session.user as { role?: string }).role,
				},
				router,
			);
		});

		const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
		await server.connect(transport);
		return transport.handleRequest(request);
	} catch (error) {
		console.error("[MCP] Internal error:", error);
		const message = error instanceof Error ? error.message : String(error);
		return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
