import { env } from "@/lib/env";

export function GET() {
	const webUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
	const backendUrl = env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "");

	// A2A Agent Card (https://a2a-protocol.org). RECONNED has no A2A JSON-RPC
	// endpoint yet — this card exists for discovery and points agents at the MCP
	// server and REST API, which are the supported ways to interact.
	const body = {
		protocolVersion: "0.3.0",
		name: "RECONNED",
		description:
			"Airsoft club and event platform. No A2A transport is available yet — interact via the MCP server " +
			`at ${backendUrl}/api/mcp (streamable HTTP, OAuth) or the REST API described at ${webUrl}/.well-known/api-catalog.`,
		url: webUrl,
		preferredTransport: "JSONRPC",
		provider: {
			organization: "RECONNED",
			url: webUrl,
		},
		version: "1.0.0",
		documentationUrl: `${webUrl}/auth.md`,
		capabilities: {
			streaming: false,
			pushNotifications: false,
			stateTransitionHistory: false,
		},
		defaultInputModes: ["text/plain"],
		defaultOutputModes: ["text/plain", "application/json"],
		skills: [
			{
				id: "search-clubs",
				name: "Search airsoft clubs",
				description: "Find public airsoft clubs by name or location.",
				tags: ["airsoft", "clubs", "search"],
			},
			{
				id: "search-events",
				name: "Search airsoft events",
				description: "Find public airsoft events by name or location.",
				tags: ["airsoft", "events", "search"],
			},
		],
	};

	return new Response(JSON.stringify(body), {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "application/json; charset=utf-8",
		},
	});
}
