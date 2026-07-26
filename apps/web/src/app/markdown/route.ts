import type { NextRequest } from "next/server";
import TurndownService from "turndown";

const turndownService = new TurndownService({
	bulletListMarker: "-",
	codeBlockStyle: "fenced",
	headingStyle: "atx",
});
// `header`/`footer` are the site chrome — dropping them cuts ~21% of the output
// with no loss of page content. Everything else here is non-prose.
//
// Deliberately NOT dropping `main`-adjacent wrappers or keying off `<main>` at all:
// under streaming SSR the landmark holds only the Suspense shell (~1.9KB), and the
// real content is appended to the end of `<body>` in out-of-order chunks. Extracting
// `<main>` yields an empty document — measured against production HTML, 0 of 12
// clubs survived, versus 12 of 12 for the whole body.
turndownService.remove([
	"script",
	"style",
	"noscript",
	"head",
	"meta",
	"link",
	"iframe",
	"template",
	"header",
	"footer",
]);
// `svg` goes through a filter rather than the list above: turndown types `remove`
// against `HTMLElementTagNameMap`, which has no SVG entry.
turndownService.remove((node) => node.nodeName.toLowerCase() === "svg");
// `remove` does not apply to `img` — turndown's own image rule claims it first, so
// it takes a rule override. Alt text duplicates the adjacent heading on every card,
// so dropping images loses no information and saves roughly a third of the tokens.
turndownService.addRule("stripImages", {
	filter: "img",
	replacement: () => "",
});

/** Content lives in `<body>`; see the note on the remove list above. */
function extractContent(html: string): string {
	return html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
}

/**
 * Serves a markdown rendering of any public HTML page. Not called directly — the
 * proxy rewrites here for a `.md` path suffix, passing the original path as
 * `source`.
 *
 * Deliberately NOT under `/api/`: in production the edge proxy routes every
 * `/api/*` path to the backend before it reaches Next, so a route handler there
 * is unreachable. It only appeared to work in dev because `next.config.ts`
 * rewrites are `afterFiles` and lose to a local filesystem route.
 */
export async function GET(request: NextRequest) {
	const source = request.nextUrl.searchParams.get("source") ?? request.headers.get("x-md-source");
	if (!source?.startsWith("/") || source.startsWith("/api") || source.startsWith("/_next")) {
		return new Response("Invalid path", { status: 400 });
	}

	// Self-fetch renders the page through the full stack (locale negotiation
	// included). Aimed at the loopback interface rather than `request.url`: the
	// public origin would send this request back out through the CDN and in to a
	// fresh container, which is slow, cache-polluting, and fails outright where
	// egress to our own hostname is blocked. The original `host` is forwarded so
	// Next still builds absolute URLs against the public origin, and
	// `accept: text/html` keeps the proxy from rewriting the internal request
	// straight back here.
	// `PORT` is what the container sets; `nextUrl.port` covers dev, where Next
	// silently picks the next free port (3001, 3002…) without exporting `PORT`.
	const port = process.env.PORT || request.nextUrl.port || "3000";
	const sourceUrl = new URL(source, `http://127.0.0.1:${port}`);
	const sourceResponse = await fetch(sourceUrl, {
		headers: {
			accept: "text/html",
			host: request.headers.get("host") ?? new URL(request.url).host,
			"accept-language": request.headers.get("accept-language") ?? "",
		},
		cache: "no-store",
	});

	if (sourceResponse.ok === false) {
		return new Response("Failed to fetch source page", { status: sourceResponse.status });
	}

	const html = await sourceResponse.text();
	// Card layouts nest several block elements per link, which turndown renders as
	// runs of blank lines; collapsing them is a few percent of tokens for free.
	const markdown = turndownService
		.turndown(extractContent(html))
		.trim()
		.replace(/\n{3,}/g, "\n\n");

	return new Response(markdown, {
		status: 200,
		headers: {
			"cache-control": "public, s-maxage=300, stale-while-revalidate=600",
			"content-type": "text/markdown; charset=utf-8",
			// Rough token estimate (~4 chars/token) so agents can budget before reading.
			"x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
		},
	});
}
