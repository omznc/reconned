import type { NextRequest } from "next/server";
import TurndownService from "turndown";

const turndownService = new TurndownService({
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	headingStyle: "atx",
});
turndownService.remove(["script", "style", "noscript", "head", "meta", "link", "iframe", "template"]);

export async function GET(request: NextRequest) {
	const source = request.nextUrl.searchParams.get("source") ?? request.headers.get("x-md-source");
	if (!source || !source.startsWith("/") || source.startsWith("/api") || source.startsWith("/_next")) {
		return new Response("Invalid path", { status: 400 });
	}

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
			vary: "Accept",
		},
	});
}
