import { env } from "@/lib/env";

export function GET() {
	const webUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
	const backendUrl = env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, "");

	const body = [
		"# AGENTS.md — RECONNED",
		"",
		"Guidance for AI agents interacting with RECONNED, an airsoft club and event platform.",
		"",
		"## Reading content",
		"",
		"- Any public page can be fetched as markdown: send `Accept: text/markdown`,",
		"  or append `.md` to the path (e.g. `/clubs.md`, `/events.md`).",
		"- Responses include an `x-markdown-tokens` header with an approximate token count.",
		`- Site overview and key links: ${webUrl}/llms.txt`,
		`- Page index: ${webUrl}/sitemap.md (XML: ${webUrl}/sitemap.xml)`,
		"",
		"## Programmatic access",
		"",
		`- REST API: ${backendUrl}/api (OpenAPI: ${backendUrl}/api/openapi.json, docs: ${backendUrl}/api/docs)`,
		`- API catalog (RFC 9727): ${webUrl}/.well-known/api-catalog`,
		`- MCP server: ${backendUrl}/api/mcp (card: ${webUrl}/.well-known/mcp/server-card.json)`,
		`- Authentication guide: ${webUrl}/auth.md`,
		"",
		"## Conventions",
		"",
		"- Public read endpoints need no authentication; writes require an OAuth token (see auth guide).",
		"- Content is available in multiple languages via locale-prefixed paths (e.g. `/en/clubs`).",
		"- Usage preferences are declared in `robots.txt` via Content-Signal.",
	].join("\n");

	return new Response(body, {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "text/markdown; charset=utf-8",
		},
	});
}
