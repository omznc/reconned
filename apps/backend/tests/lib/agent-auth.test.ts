import { describe, expect, test } from "bun:test";
// `agent-auth.ts` imports nothing at all, so it is safe to import statically.
import { OAUTH_DISCOVERY_PATHS, withAgentAuth } from "../../src/lib/agent-auth";

const METADATA = JSON.stringify({
	issuer: "https://reconned.com",
	authorization_endpoint: "https://reconned.com/api/auth/mcp/authorize",
	token_endpoint: "https://reconned.com/api/auth/mcp/token",
	registration_endpoint: "https://reconned.com/api/auth/mcp/register",
});

function parse(body: string) {
	return JSON.parse(body) as Record<string, unknown> & {
		agent_auth?: Record<string, unknown>;
	};
}

describe("withAgentAuth", () => {
	test("adds the fields auth.md scanners require", () => {
		const block = parse(withAgentAuth(METADATA, "https://reconned.com")).agent_auth;

		expect(block).toBeDefined();
		expect(block?.skill).toBe("https://reconned.com/auth.md");
		expect(block?.register_uri).toBe("https://reconned.com/api/auth/mcp/register");
		expect(block?.identity_types_supported).toEqual(["end_user"]);
		expect(block?.credential_types_supported).toEqual(["oauth2_access_token"]);
		expect(block?.registration_methods_supported).toEqual(["oauth_dynamic_client_registration"]);
	});

	test("describes the advertised registration method completely", () => {
		const block = parse(withAgentAuth(METADATA, "https://reconned.com")).agent_auth;
		const method = block?.oauth_dynamic_client_registration as Record<string, unknown>;

		// A method named in `registration_methods_supported` with no matching block is worse
		// than not naming it: agents discover a method they cannot then act on.
		expect(method.register_uri).toBe("https://reconned.com/api/auth/mcp/register");
		expect(method.token_endpoint).toBe("https://reconned.com/api/auth/mcp/token");
		expect(method.authorization_endpoint).toBe("https://reconned.com/api/auth/mcp/authorize");
		expect(method.code_challenge_methods_supported).toEqual(["S256"]);
	});

	test("preserves the RFC 8414 fields it wraps", () => {
		const metadata = parse(withAgentAuth(METADATA, "https://reconned.com"));

		// The `issuer` in particular: scanners cross-check it against the one advertised in
		// protected resource metadata.
		expect(metadata.issuer).toBe("https://reconned.com");
		expect(metadata.token_endpoint).toBe("https://reconned.com/api/auth/mcp/token");
	});

	test("keeps agent_auth links on the issuer's host", () => {
		// A trailing slash on the configured URL would otherwise produce `//auth.md`.
		const block = parse(withAgentAuth(METADATA, "https://reconned.com/")).agent_auth;

		expect(block?.skill).toBe("https://reconned.com/auth.md");
	});

	test("falls back to the known register path when upstream omits it", () => {
		const body = JSON.stringify({ issuer: "https://reconned.com" });
		const block = parse(withAgentAuth(body, "https://reconned.com")).agent_auth;

		expect(block?.register_uri).toBe("https://reconned.com/api/auth/mcp/register");
	});

	test("passes non-object bodies through untouched", () => {
		// A change upstream should degrade to plain metadata, not a document agents cannot
		// parse.
		expect(withAgentAuth("not json", "https://reconned.com")).toBe("not json");
		expect(withAgentAuth("[1,2]", "https://reconned.com")).toBe("[1,2]");
		expect(withAgentAuth("null", "https://reconned.com")).toBe("null");
	});
});

describe("OAUTH_DISCOVERY_PATHS", () => {
	test("covers both documents agents read off the site root", () => {
		expect(OAUTH_DISCOVERY_PATHS.has("/.well-known/oauth-authorization-server")).toBe(true);
		expect(OAUTH_DISCOVERY_PATHS.has("/.well-known/oauth-protected-resource")).toBe(true);
	});
});
