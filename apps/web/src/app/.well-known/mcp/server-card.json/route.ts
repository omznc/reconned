import { env } from "@/lib/env";

export function GET() {
	const webUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
	const backendUrl = env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "");

	// MCP Server Card (SEP-1649).
	const body = {
		serverInfo: {
			name: "reconned-mcp",
			title: "RECONNED",
			version: "1.0.0",
			description:
				"Airsoft club and event platform. Search clubs, events, and players; manage memberships, registrations, posts, and reviews.",
			websiteUrl: webUrl,
		},
		transport: {
			type: "streamable-http",
			endpoint: `${backendUrl}/api/mcp`,
		},
		capabilities: {
			tools: {},
		},
		authentication: {
			type: "oauth2",
			protectedResourceMetadata: `${webUrl}/.well-known/oauth-protected-resource`,
			authorizationServerMetadata: `${webUrl}/.well-known/oauth-authorization-server`,
		},
		documentation: `${webUrl}/auth.md`,
	};

	return new Response(JSON.stringify(body), {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "application/json; charset=utf-8",
		},
	});
}
