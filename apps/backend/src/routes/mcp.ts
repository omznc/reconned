import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { instrument } from "@posthog/mcp";
import type { Router } from "@reconned/router";
import { eq } from "drizzle-orm";
import { PostHog } from "posthog-node";
import { user as userTable } from "../drizzle/schema";
import { auth } from "../lib/auth";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { executeMcpTool, extractMcpTools, isWriteTool } from "../lib/mcp-bridge";

export const mcpPosthog = new PostHog(env.POSTHOG_PUBLIC_KEY, {
	host: process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
	enableExceptionAutocapture: true,
});

type McpUser = { id: string; email: string; name: string; role?: string };

// Resolve the caller from either a Reconned API key / session cookie (X-API-Key,
// used by CLI/curl) or an OAuth 2.0 access token issued via the better-auth mcp()
// plugin (used by remote connectors like the claude.ai MCP integration).
async function resolveMcpUser(request: Request, headers: Headers): Promise<McpUser | null> {
	// Strip any Authorization header from the cookie-based session check — the
	// api-key plugin (enableSessionForAPIKeys) would try to validate an OAuth
	// Bearer token as an API key and throw FORBIDDEN.
	const cookieHeaders = new Headers(headers);
	cookieHeaders.delete("Authorization");
	const session = await auth.api.getSession({ headers: cookieHeaders });
	if (session?.user) {
		return {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
			role: (session.user as { role?: string }).role,
		};
	}

	const mcpSession = await auth.api.getMcpSession({ headers: request.headers });
	if (mcpSession?.userId) {
		const [found] = await db
			.select({ email: userTable.email, name: userTable.name, role: userTable.role })
			.from(userTable)
			.where(eq(userTable.id, mcpSession.userId))
			.limit(1);
		if (found) {
			return { id: mcpSession.userId, email: found.email, name: found.name, role: found.role ?? undefined };
		}
	}

	return null;
}

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
	// Don't sync Authorization → X-API-Key: the api-key plugin would try to
	// validate an OAuth access token as an API key and reject it.

	try {
		const authUser = await resolveMcpUser(request, headers);
		if (!authUser) {
			// Point MCP connectors at the OAuth protected-resource metadata so they can
			// discover the authorization server and start the login flow (RFC 9728).
			const resourceMetadataUrl = `${env.BETTER_AUTH_URL}/api/auth/.well-known/oauth-protected-resource`;
			return new Response(
				JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null }),
				{
					status: 401,
					headers: {
						"Content-Type": "application/json",
						"WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
						"Access-Control-Expose-Headers": "WWW-Authenticate",
					},
				},
			);
		}
		const userId = authUser.id;
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
			return executeMcpTool(name, args ?? {}, authUser, router);
		});

		// Must come after the handlers are registered: instrument() wraps whatever
		// tools/call handler exists at call time, and a later setRequestHandler for
		// tools/call replaces its wrapper outright — so instrumenting first silently
		// drops every tool-call event.
		instrument(server, mcpPosthog, {
			identify: async () => ({ distinctId: userId }),
			// The identify hook only runs on initialize and tools/call, so tools/list events
			// fall back to the session id as their distinct_id and land on a separate,
			// anonymous person. We've already authenticated the caller for this entire
			// request, so pin every event to them rather than letting attribution split.
			beforeSend: (event) => {
				event.distinct_id = userId;
				return event;
			},
			// @posthog/mcp's logger is a no-op until one is supplied, so without this every
			// warning it raises — including "failed to instrument server" — is dropped and
			// analytics go silently dark.
			logger: (message) => console.error("[MCP analytics]", message),
		});

		// enableJsonResponse is what makes analytics sessions hold together. We're stateless
		// (sessionIdGenerator: undefined), so @posthog/mcp recovers session continuity by
		// minting a token into the Mcp-Session-Id response header that clients replay on every
		// request. That header only reaches the wire when response headers are built after the
		// handler runs — in SSE mode they're flushed first, the mint is a no-op, and every tool
		// call looks like a brand-new session.
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);
		const response = await transport.handleRequest(request);
		mcpPosthog.flush().catch(() => {});
		return response;
	} catch (error) {
		console.error("[MCP] Internal error:", error);
		const message = error instanceof Error ? error.message : String(error);
		return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
