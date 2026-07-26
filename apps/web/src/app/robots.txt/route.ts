import { env } from "@/lib/env";

export function GET() {
	const baseUrl = env.NEXT_PUBLIC_WEB_URL?.replace(/\/$/, "") ?? "";

	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/",
		"Disallow: /dashboard/",
		// The markdown renderer is an internal rewrite target. Crawling it directly
		// would index every page a second time under a URL that is not canonical.
		"Disallow: /markdown",
		"Content-Signal: search=yes, ai-input=yes, ai-train=no",
		`Sitemap: ${baseUrl}/sitemap.xml`,
		"",
		"# Agent-facing indexes (not a crawler directive; here for discovery)",
		`# ${baseUrl}/llms.txt`,
		`# ${baseUrl}/llms-full.txt`,
		`# ${baseUrl}/AGENTS.md`,
		`# ${baseUrl}/.well-known/api-catalog`,
	].join("\n");

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}
