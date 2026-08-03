import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { matchAcceptLanguage } from "@/i18n/accept-language";
import { getLocaleFromCountry } from "@/i18n/country-locale";
import { routing } from "@/i18n/routing";

/**
 * Single instance with a fixed `defaultLocale` — unprefixed URLs always mean
 * `bs`, regardless of who is asking. Geo only influences the redirect target
 * for first-time visitors (see below), never what an unprefixed URL serves:
 * varying the default per request made the same URL geo-dependent, which broke
 * CDN caching and left crawlers indexing whatever their exit IP negotiated.
 */
const i18nMiddleware = createMiddleware(routing);

/** The only `/.well-known/` paths better-auth serves, and so the only ones worth proxying. */
const OAUTH_DISCOVERY_PREFIXES = ["/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource"];

/** `/.well-known/` paths served by route handlers; everything else 404s. */
const SERVED_WELL_KNOWN = new Set([
	"/.well-known/api-catalog",
	"/.well-known/mcp/server-card.json",
	"/.well-known/mcp.json",
	"/.well-known/agent-card.json",
	"/.well-known/agent-skills/index.json",
]);

/**
 * `/.well-known/` prefixes served by dynamic route handlers. The skill name is a
 * route param, so the paths cannot be enumerated in the set above.
 */
const SERVED_WELL_KNOWN_PREFIXES = ["/.well-known/agent-skills/"];

/** Routes that serve markdown themselves, exempt from the `.md` → HTML-page rewrite. */
const MARKDOWN_ROUTES = new Set(["/auth.md", "/AGENTS.md", "/sitemap.md"]);

/**
 * Adds the auth.md `agent_auth` block to RFC 8414 authorization server metadata
 * (https://github.com/workos/auth.md).
 *
 * Only mechanisms RECONNED actually implements are advertised: registration is
 * OAuth 2.0 Dynamic Client Registration (RFC 7591) and the resulting credential
 * is a bearer access token obtained by a human user consenting in the browser.
 * There is deliberately no `claim_uri` or ID-JAG assertion support here — those
 * describe flows RECONNED does not serve, and pointing agents at endpoints that
 * do not exist is worse for discovery than omitting them.
 *
 * Returns the body unchanged if it is not the JSON object we expect, so a
 * change upstream degrades to plain proxying instead of a broken document.
 */
function withAgentAuth(body: string, webUrl: string): string {
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
	const registerUri =
		typeof record.registration_endpoint === "string"
			? record.registration_endpoint
			: `${webUrl}/api/auth/mcp/register`;

	return JSON.stringify({
		...record,
		agent_auth: {
			skill: `${webUrl}/auth.md`,
			register_uri: registerUri,
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
		},
	});
}

function isDashboardPath(pathname: string): boolean {
	// Segment match, not a substring match: `/dashboard`, `/dashboard/...`,
	// `/en/dashboard`, `/en/dashboard/...` — but not `/clubs/my-dashboard`.
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] === "dashboard") {
		return true;
	}
	return routing.locales.includes(segments[0] as (typeof routing.locales)[number]) && segments[1] === "dashboard";
}

export default async function authProxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Proxy well-known metadata (OAuth discovery for MCP server) to the backend.
	// Must fetch manually — NextResponse.rewrite with our own origin does an
	// internal rewrite instead of proxying, and Rewrite with an external origin
	// would break in Docker.
	//
	// Scoped to the two OAuth prefixes rather than all of `/.well-known/`: middleware runs before
	// route handlers, so a catch-all here shadowed `app/.well-known/api-catalog/route.ts` entirely
	// and forwarded it to `/api/auth/.well-known/api-catalog`, which better-auth does not serve —
	// the catalog answered 404 in production.
	if (OAUTH_DISCOVERY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		const backendUrl =
			process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
		const target = new URL(`/api/auth${pathname}`, backendUrl);
		const proxy = await fetch(target);
		const text = await proxy.text();

		// better-auth generates RFC 8414 metadata but knows nothing about auth.md,
		// so the `agent_auth` block is merged in here rather than upstream.
		const augmented =
			proxy.ok && pathname.startsWith("/.well-known/oauth-authorization-server")
				? // The configured web URL, not the request origin — `agent_auth` links must
					// sit on the same host as the `issuer` better-auth already advertises.
					withAgentAuth(text, (process.env.NEXT_PUBLIC_WEB_URL || request.nextUrl.origin).replace(/\/$/, ""))
				: text;

		const headers = new Headers(proxy.headers);
		// The body length changed, and the upstream encoding was already undone by
		// `fetch` — forwarding either header would describe a body we are not sending.
		headers.delete("content-length");
		headers.delete("content-encoding");

		return new Response(augmented, { status: proxy.status, headers });
	}

	// Other `/.well-known/` paths we actually serve — locale negotiation below
	// would rewrite them into `[locale]` and answer with the HTML 404 page.
	// Everything else under `/.well-known/` gets a plain 404: with no matching
	// route, Next renders the root not-found outside the locale tree and 500s,
	// and agent scanners read HTML error pages as malformed discovery documents.
	if (pathname.startsWith("/.well-known/")) {
		const isServed =
			SERVED_WELL_KNOWN.has(pathname) || SERVED_WELL_KNOWN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
		return isServed ? NextResponse.next() : new Response("Not Found", { status: 404 });
	}

	// Real routes that already serve markdown — the `.md` matcher pulls them in
	// here, and the rewrite below (or the locale rewriter) would break them.
	if (MARKDOWN_ROUTES.has(pathname)) {
		return NextResponse.next();
	}

	// The markdown renderer itself. Reached by internal rewrite (which does not
	// re-enter this proxy), so this only guards a direct request — without it the
	// locale rewriter would send `/markdown` to `/bs/markdown` and 404.
	if (pathname === "/markdown") {
		return NextResponse.next();
	}

	// Markdown for agents. The `.md` path suffix (e.g. `/clubs.md`) is the real
	// mechanism; `Accept: text/markdown` is honoured by *redirecting* to that path
	// rather than rewriting in place.
	//
	// Rewriting on the header cannot work behind our CDN: HTML pages are cached
	// under a key that ignores `Accept` (Cloudflare only varies on
	// `Accept-Encoding`, whatever `Vary` the origin sets), so a header-negotiated
	// request lands on a cached HTML entry and never reaches this proxy at all.
	// A distinct URL is a distinct cache key, which makes the negotiation actually
	// observable. 307 keeps it non-permanent — the HTML URL stays canonical.
	const isMarkdownPath = pathname.endsWith(".md");
	const wantsMarkdown = (request.headers.get("accept") ?? "").includes("text/markdown");
	const isMarkdownEligible =
		!isDashboardPath(pathname) && !pathname.startsWith("/api") && !pathname.startsWith("/_next");

	if (wantsMarkdown && !isMarkdownPath && isMarkdownEligible) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = `${pathname === "/" ? "/index" : pathname}.md`;
		return NextResponse.redirect(redirectUrl, 307);
	}

	if (isMarkdownPath && isMarkdownEligible) {
		const markdownUrl = new URL("/markdown", request.url);
		// `/index.md` is the redirect target for the root page, which has no path to
		// strip back to beyond "/".
		const stripped = pathname.slice(0, -3);
		const normalizedPath = stripped === "/index" ? "/" : stripped;
		const source = `${normalizedPath}${request.nextUrl.search}`;
		markdownUrl.searchParams.set("source", source);
		const headers = new Headers(request.headers);
		headers.set("x-md-source", source);
		return NextResponse.rewrite(markdownUrl, { request: { headers } });
	}

	const hasLocalePrefix = routing.locales.some(
		(locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
	);
	if (pathname.includes("opengraph-image")) {
		if (!hasLocalePrefix) {
			const rewriteUrl = request.nextUrl.clone();
			rewriteUrl.pathname = `/${routing.defaultLocale}${pathname}`;
			return NextResponse.rewrite(rewriteUrl);
		}
		return NextResponse.next();
	}

	if (isDashboardPath(pathname)) {
		// Cookie-presence check only — an optimization to avoid rendering the
		// dashboard shell for obviously-anonymous requests. Pages re-verify the
		// session server-side, so this must never become an HTTP call.
		const sessionCookie = getSessionCookie(request);
		if (!sessionCookie) {
			const loginUrl = new URL("/login", request.url);
			loginUrl.searchParams.set("redirectTo", pathname);
			return NextResponse.redirect(loginUrl);
		}
	}

	// Geo hint for first-time visitors only: no cookie, no locale prefix, and
	// nothing usable in `Accept-Language` (next-intl handles cookie and
	// `Accept-Language` negotiation itself). Sets the cookie so the choice
	// sticks and this branch never fires again for the same visitor. 307, not
	// 308 — geo redirects must stay temporary for crawlers.
	if (
		!hasLocalePrefix &&
		!request.cookies.has("NEXT_LOCALE") &&
		!matchAcceptLanguage(request.headers.get("accept-language"))
	) {
		const geoLocale = getLocaleFromCountry(request.headers.get("CF-IPCountry"));
		if (geoLocale !== routing.defaultLocale) {
			const redirectUrl = request.nextUrl.clone();
			redirectUrl.pathname = `/${geoLocale}${pathname === "/" ? "" : pathname}`;
			const response = NextResponse.redirect(redirectUrl);
			response.cookies.set("NEXT_LOCALE", geoLocale, {
				path: "/",
				maxAge: 60 * 60 * 24 * 365,
				sameSite: "lax",
			});
			return response;
		}
	}

	// Handles the rest of locale negotiation: `NEXT_LOCALE` cookie first, then
	// `Accept-Language`, then the fixed `defaultLocale` (`bs`).
	return i18nMiddleware(request);
}

export const config = {
	matcher: ["/((?!api|_next|.*\\..*).*)", "/.well-known/:path*", "/:path*.md"],
};
