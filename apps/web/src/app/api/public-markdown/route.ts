import type { NextRequest } from "next/server";
import TurndownService from "turndown";

const turndownService = new TurndownService({
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	headingStyle: "atx",
});
turndownService.remove(["script", "style", "noscript", "head", "meta", "link", "iframe", "template"]);

/**
 * Serves a markdown rendering of any public HTML page. Not called directly —
 * the proxy rewrites here when a request has `Accept: text/markdown` or a
 * `.md` path suffix, passing the original path as `source`.
 */
export async function GET(request: NextRequest) {
	const source = request.nextUrl.searchParams.get("source") ?? request.headers.get("x-md-source");
	if (!source?.startsWith("/") || source.startsWith("/api") || source.startsWith("/_next")) {
		return new Response("Invalid path", { status: 400 });
	}

	// Self-fetch renders the page through the full stack (locale negotiation
	// included). `accept: text/html` prevents the proxy from rewriting the
	// internal request back here.
	const sourceUrl = new URL(source, request.url);
	const sourceResponse = await fetch(sourceUrl, {
		headers: { accept: "text/html" },
		cache: "no-store",
	});

	if (sourceResponse.ok === false) {
		return new Response("Failed to fetch source page", { status: sourceResponse.status });
	}

	const html = await sourceResponse.text();
	const markdown = turndownService.turndown(html);

	return new Response(markdown, {
		status: 200,
		headers: {
			"cache-control": "public, s-maxage=300, stale-while-revalidate=600",
			"content-type": "text/markdown; charset=utf-8",
			// Rough token estimate (~4 chars/token) so agents can budget before reading.
			"x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
			vary: "Accept",
		},
	});
}
