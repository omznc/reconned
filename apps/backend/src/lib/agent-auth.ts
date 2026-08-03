/**
 * The auth.md `agent_auth` block (https://github.com/workos/auth.md), merged into the
 * RFC 8414 authorization server metadata better-auth generates.
 *
 * This lives in the backend rather than in the web app's proxy because the two are not
 * equally reachable: the web proxy only sees `/.well-known/oauth-*` when the request
 * actually traverses Next.js, and in production the edge routes those paths straight to
 * this service. Injecting at the source means the block is present in the document no
 * matter which layer serves it — the web proxy just forwards what it gets.
 *
 * Only mechanisms RECONNED actually implements are advertised: registration is OAuth 2.0
 * Dynamic Client Registration (RFC 7591) and the resulting credential is a bearer access
 * token obtained by a human user consenting in the browser. There is deliberately no
 * `identity_endpoint`, `claim_uri` or ID-JAG assertion support here — those describe
 * flows RECONNED does not serve, and pointing agents at endpoints that do not exist is
 * worse for discovery than omitting them.
 */

/** Path better-auth serves the RFC 8414 document on, relative to the backend origin. */
export const AUTHORIZATION_SERVER_METADATA_PATH = "/api/auth/.well-known/oauth-authorization-server";

/**
 * Root-level discovery paths. Agents and scanners read these off the site root, and the
 * production edge forwards them here verbatim rather than under `/api/auth`, so the
 * backend answers both spellings.
 */
export const OAUTH_DISCOVERY_PATHS = new Set([
	"/.well-known/oauth-authorization-server",
	"/.well-known/oauth-protected-resource",
]);

function buildAgentAuth(record: Record<string, unknown>, webUrl: string) {
	const registerUri =
		typeof record.registration_endpoint === "string"
			? record.registration_endpoint
			: `${webUrl}/api/auth/mcp/register`;

	return {
		skill: `${webUrl}/auth.md`,
		register_uri: registerUri,
		// Not one of the spec's `anonymous` / `identity_assertion` / `service_auth` values:
		// those all describe the `/agent/identity` ceremony, which RECONNED does not
		// implement. An agent here acts for a signed-in human, so say that plainly instead
		// of claiming a flow that would fail on the first call.
		identity_types_supported: ["end_user"],
		credential_types_supported: ["oauth2_access_token"],
		registration_methods_supported: ["oauth_dynamic_client_registration"],
		oauth_dynamic_client_registration: {
			register_uri: registerUri,
			grant_types_supported: ["authorization_code", "refresh_token"],
			code_challenge_methods_supported: ["S256"],
			token_endpoint: record.token_endpoint,
			authorization_endpoint: record.authorization_endpoint,
		},
	};
}

/**
 * Returns `body` with the `agent_auth` block merged in, or unchanged if it is not the JSON
 * object we expect — a change upstream degrades to plain metadata rather than a document
 * agents cannot parse.
 */
export function withAgentAuth(body: string, webUrl: string): string {
	let metadata: unknown;
	try {
		metadata = JSON.parse(body);
	} catch {
		return body;
	}

	if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
		return body;
	}

	const record = metadata as Record<string, unknown>;
	return JSON.stringify({ ...record, agent_auth: buildAgentAuth(record, webUrl.replace(/\/$/, "")) });
}
