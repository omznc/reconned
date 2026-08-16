import { env } from "@/lib/env";

export function GET() {
	const webUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
	const backendUrl = env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "");

	const body = [
		// The H1 must contain "auth.md" — scanners key off it to confirm the
		// document is an auth.md rather than an arbitrary page at this path.
		"# auth.md — RECONNED",
		"",
		"RECONNED supports programmatic access for AI agents via OAuth 2.0 and MCP.",
		"",
		"## Discovery",
		"",
		`- Authorization server metadata: ${webUrl}/.well-known/oauth-authorization-server`,
		`- Protected resource metadata: ${webUrl}/.well-known/oauth-protected-resource`,
		`- MCP server card: ${webUrl}/.well-known/mcp/server-card.json`,
		`- API catalog: ${webUrl}/.well-known/api-catalog`,
		`- Agent skills index: ${webUrl}/.well-known/agent-skills/index.json`,
		"",
		"## Registration",
		"",
		"Clients register via OAuth 2.0 Dynamic Client Registration (RFC 7591).",
		"The `registration_endpoint` is advertised in the authorization server metadata above,",
		"and repeated in its `agent_auth` block as `register_uri`.",
		"",
		"Registration is the only supported entry point. RECONNED does not implement ID-JAG",
		"identity assertions, verified-email claims, or anonymous agent identities, so there is",
		"no `/agent/identity` or claim endpoint to call.",
		"",
		"## Connecting over MCP",
		"",
		`The MCP endpoint is ${backendUrl}/api/mcp (Streamable HTTP transport).`,
		"Unauthenticated requests receive `401 Unauthorized` with a `WWW-Authenticate` header",
		"pointing at the protected resource metadata (RFC 9728); follow it to discover the",
		"authorization server and complete the OAuth flow.",
		"",
		"## Identity and credentials",
		"",
		"- Supported identity types: end users (human accounts acting via an agent)",
		"- Credential type: OAuth 2.0 bearer access tokens",
		"- Revocation: users can revoke agent access from their dashboard settings",
		"",
		"## Direct API access",
		"",
		`The REST API is documented at ${backendUrl}/api/docs (OpenAPI: ${backendUrl}/api/openapi.json).`,
		"Public read endpoints require no authentication; authenticated endpoints accept the",
		"same OAuth bearer tokens as MCP.",
	].join("\n");

	return new Response(body, {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "text/markdown; charset=utf-8",
		},
	});
}
