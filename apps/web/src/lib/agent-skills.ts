import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Skills published at `/.well-known/agent-skills/` per the Agent Skills
 * Discovery RFC v0.2.0 (https://github.com/cloudflare/agent-skills-discovery-rfc).
 *
 * The index advertises a `sha256:` digest of each artifact, so the SKILL.md
 * bodies and the index must be generated from the same source — hence one
 * module that both routes import rather than two hand-synced copies. Digests
 * are computed over the exact bytes served, so they stay correct even though
 * the bodies interpolate environment-dependent URLs.
 */

export type AgentSkill = {
	/** Lowercase alphanumeric + hyphens, per the RFC. */
	name: string;
	description: string;
	body: (urls: { webUrl: string; backendUrl: string }) => string;
};

export const AGENT_SKILLS: AgentSkill[] = [
	{
		name: "reconned-search",
		description:
			"Search airsoft clubs, events, and players on RECONNED through the public REST API. Use when looking up airsoft clubs or events by name, location, or date, with no authentication required.",
		body: ({ webUrl, backendUrl }) =>
			[
				"# reconned-search",
				"",
				"Search airsoft clubs, events, and players on RECONNED.",
				"",
				"## When to use",
				"",
				"Use this skill to answer questions about airsoft clubs, events, or players listed on",
				"RECONNED — finding clubs in a city, upcoming events on a date, or a player's public",
				"profile. All endpoints below are public and need no authentication.",
				"",
				"## Endpoints",
				"",
				`Base URL: \`${backendUrl}/api\``,
				"",
				"| Endpoint | Purpose |",
				"| --- | --- |",
				"| `GET /clubs` | Search clubs. Query: `search`, `page`, `perPage`. |",
				"| `GET /clubs/{id}` | A single club, with its rules and public info. |",
				"| `GET /events` | Search events. Query: `search`, `page`, `perPage`. |",
				"| `GET /events/{id}` | A single event, with rules and registration counts. |",
				"| `GET /events/upcoming` | Events that have not started yet. |",
				"| `GET /users` | Search public player profiles. |",
				"",
				"Responses are JSON and paginated; `page` starts at 1.",
				"",
				"## Example",
				"",
				"```http",
				`GET ${backendUrl}/api/clubs?search=Sarajevo&page=1&perPage=10`,
				"Accept: application/json",
				"```",
				"",
				"## Reading pages instead",
				"",
				"Every public page is also available as markdown — append `.md` to the path or send",
				`\`Accept: text/markdown\`. See ${webUrl}/AGENTS.md for the full set of conventions.`,
				"",
				"## Related",
				"",
				`- OpenAPI description: ${backendUrl}/api/openapi.json`,
				`- MCP server (same data as tools): ${backendUrl}/api/mcp`,
				`- Authentication, for anything beyond reading: ${webUrl}/auth.md`,
			].join("\n"),
	},
	{
		name: "reconned-auth",
		description:
			"Authenticate to RECONNED on behalf of a user via OAuth 2.0 and connect to its MCP server. Use when an action needs a signed-in user — joining a club, registering for an event, or posting.",
		body: ({ webUrl, backendUrl }) =>
			[
				"# reconned-auth",
				"",
				"Authenticate to RECONNED on behalf of a user.",
				"",
				"## When to use",
				"",
				"Use this skill when a task needs more than public reads — joining a club, registering",
				"for an event, writing a post or review, or reading a user's own data. Public search",
				"needs no authentication; see the `reconned-search` skill for that.",
				"",
				"## Flow",
				"",
				"RECONNED is an OAuth 2.0 authorization server. Agents authenticate as a human user who",
				"grants access; there is no machine-only credential.",
				"",
				`1. Fetch ${webUrl}/.well-known/oauth-protected-resource to discover the authorization server.`,
				`2. Fetch ${webUrl}/.well-known/oauth-authorization-server for endpoints (RFC 8414).`,
				"3. Register a client at the advertised `registration_endpoint` using OAuth 2.0 Dynamic",
				"   Client Registration (RFC 7591).",
				"4. Run the authorization code flow with PKCE (`S256`). The user signs in and consents",
				"   in their browser.",
				"5. Call the API or MCP server with `Authorization: Bearer <access_token>`.",
				"",
				"Supported scopes: `openid`, `profile`, `email`, `offline_access`.",
				"",
				"## MCP",
				"",
				`The MCP endpoint is \`${backendUrl}/api/mcp\` (Streamable HTTP). An unauthenticated`,
				"request returns `401` with a `WWW-Authenticate` header pointing at the protected",
				"resource metadata (RFC 9728) — follow it to start the flow above.",
				"",
				"## Revocation",
				"",
				"Users revoke agent access from their RECONNED dashboard settings. Treat a `401` on a",
				"previously working token as revoked and restart the flow rather than retrying.",
				"",
				"## Related",
				"",
				`- Full authentication guide: ${webUrl}/auth.md`,
				`- MCP server card: ${webUrl}/.well-known/mcp/server-card.json`,
			].join("\n"),
	},
];

export function getSkillUrls(): { webUrl: string; backendUrl: string } {
	return {
		webUrl: env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, ""),
		backendUrl: env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, ""),
	};
}

export function findAgentSkill(name: string): AgentSkill | undefined {
	return AGENT_SKILLS.find((skill) => skill.name === name);
}

/** `sha256:{64-char lowercase hex}`, the digest format the RFC requires. */
export function skillDigest(body: string): string {
	return `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`;
}
