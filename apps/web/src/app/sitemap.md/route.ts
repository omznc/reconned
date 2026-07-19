import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

export function GET() {
	const baseUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");

	const body = [
		"# RECONNED — Sitemap",
		"",
		`Machine-readable sitemap with lastmod dates: ${baseUrl}/sitemap.xml`,
		`Locales: ${routing.locales.join(", ")} (default ${routing.defaultLocale}; prefix paths to switch, e.g. /en/clubs).`,
		"Append `.md` to any page path for a markdown version.",
		"",
		"## Core",
		"",
		`- [Home](${baseUrl}/)`,
		`- [Clubs](${baseUrl}/clubs) — all registered airsoft clubs`,
		`- [Events](${baseUrl}/events) — upcoming and past airsoft events`,
		`- [Players](${baseUrl}/users) — public player profiles`,
		`- [Search](${baseUrl}/search) — search across clubs, events, and players`,
		`- [Map](${baseUrl}/map) — interactive map of airsoft fields and clubs`,
		`- [Alliances](${baseUrl}/alliances) — club alliances`,
		"",
		"## About",
		"",
		`- [Sponsors](${baseUrl}/sponsors)`,
		`- [Support Us](${baseUrl}/support-us)`,
		`- [Developers](${baseUrl}/developers) — API documentation and developer resources`,
		`- [Privacy Policy](${baseUrl}/privacy-policy)`,
		`- [Terms of Use](${baseUrl}/terms-of-use)`,
		"",
		"## Agent resources",
		"",
		`- [llms.txt](${baseUrl}/llms.txt)`,
		`- [AGENTS.md](${baseUrl}/AGENTS.md)`,
		`- [Authentication guide](${baseUrl}/auth.md)`,
		`- [API catalog](${baseUrl}/.well-known/api-catalog)`,
		`- [MCP server card](${baseUrl}/.well-known/mcp/server-card.json)`,
	].join("\n");

	return new Response(body, {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "text/markdown; charset=utf-8",
		},
	});
}
