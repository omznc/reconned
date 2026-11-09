import { getSessionCookie } from "better-auth/cookies";
import { matchAcceptLanguage } from "@/i18n/accept-language";
import { getLocaleFromCountry } from "@/i18n/country-locale";
import { isLocale, type Locale } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The only `/.well-known/` paths better-auth serves, and so the only ones worth proxying. */
const OAUTH_DISCOVERY_PREFIXES = ["/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource"];

/** `/.well-known/` paths served by server routes; everything else 404s. */
const SERVED_WELL_KNOWN = new Set([
	"/.well-known/api-catalog",
	"/.well-known/mcp/server-card.json",
	"/.well-known/mcp.json",
	"/.well-known/agent-card.json",
	"/.well-known/agent-skills/index.json",
]);

/** The skill name is a route param, so these paths cannot be enumerated in the set above. */
const SERVED_WELL_KNOWN_PREFIXES = ["/.well-known/agent-skills/"];

/** Routes that serve markdown themselves, exempt from the `.md` rewrite. */
const MARKDOWN_ROUTES = new Set(["/auth.md", "/AGENTS.md", "/sitemap.md"]);

/** Prefixes owned by the framework, the dev server, the backend or the PostHog proxy. */
const PASSTHROUGH_PREFIXES = ["/api", "/_", "/@", "/src/", "/node_modules/", "/warmind", "/markdown"];

const LEGACY_PREFIXES: Record<string, string> = { u: "users", e: "events", c: "clubs" };
const LEGACY_PATH = new RegExp(`^(?:/(${routing.locales.join("|")}))?/([uec])(/.*)?$`);
const SIGN_IN_PATH = new RegExp(`^(?:/(${routing.locales.join("|")}))?/sign-in$`);

export function redirectTo(url: URL, status: 307 | 308): Response {
	return new Response(null, { status, headers: { location: url.toString() } });
}

function readCookie(request: Request, name: string): string | undefined {
	const header = request.headers.get("cookie");
	if (!header) {
		return undefined;
	}
	for (const part of header.split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key === name) {
			return decodeURIComponent(value.join("="));
		}
	}
	return undefined;
}

function localeCookieHeader(locale: Locale): string {
	return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
}

function getPrefixLocale(pathname: string): Locale | undefined {
	const first = pathname.split("/")[1];
	return isLocale(first) ? first : undefined;
}

function isDashboardPath(pathname: string): boolean {
	// Segment match, not a substring match: `/dashboard`, `/en/dashboard/...`, but not `/clubs/my-dashboard`.
	const segments = pathname.split("/").filter(Boolean);
	return segments[0] === "dashboard" || (isLocale(segments[0]) && segments[1] === "dashboard");
}

/** Mirrors the `redirects()` list that `next.config.ts` used to hold. */
function legacyRedirect(url: URL): Response | undefined {
	const signIn = SIGN_IN_PATH.exec(url.pathname);
	if (signIn) {
		const target = new URL(url);
		target.pathname = `${signIn[1] ? `/${signIn[1]}` : ""}/login`;
		return redirectTo(target, 307);
	}
	const legacy = LEGACY_PATH.exec(url.pathname);
	const section = legacy?.[2] ? LEGACY_PREFIXES[legacy[2]] : undefined;
	if (legacy && section) {
		const target = new URL(url);
		target.pathname = `${legacy[1] ? `/${legacy[1]}` : ""}/${section}${legacy[3] ?? ""}`;
		return redirectTo(target, 308);
	}
	return undefined;
}

async function proxyOauthDiscovery(url: URL): Promise<Response | undefined> {
	if (!OAUTH_DISCOVERY_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
		return undefined;
	}
	const backendUrl =
		process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
	const proxy = await fetch(new URL(`/api/auth${url.pathname}`, backendUrl));

	// Forwarded verbatim, including the auth.md `agent_auth` block: the backend merges that in itself.
	const headers = new Headers(proxy.headers);
	// `fetch` already undid the upstream encoding, so forwarding either header would describe a body we are not sending.
	headers.delete("content-length");
	headers.delete("content-encoding");
	return new Response(await proxy.text(), { status: proxy.status, headers });
}

/** Unserved `/.well-known/` paths answer a plain 404: agent scanners read HTML error pages as malformed documents. */
function gateWellKnown(pathname: string): { handled: boolean; response?: Response } {
	if (!pathname.startsWith("/.well-known/")) {
		return { handled: false };
	}
	const isServed = SERVED_WELL_KNOWN.has(pathname) || SERVED_WELL_KNOWN_PREFIXES.some((p) => pathname.startsWith(p));
	return { handled: true, response: isServed ? undefined : new Response("Not Found", { status: 404 }) };
}

/**
 * Markdown for agents. The `.md` path suffix is the mechanism; `Accept: text/markdown` redirects to that
 * path (307) so the negotiation is observable behind a CDN that ignores `Accept`.
 */
async function markdownResponse(request: Request, url: URL): Promise<Response | undefined> {
	const { pathname } = url;
	if (MARKDOWN_ROUTES.has(pathname) || pathname === "/markdown") {
		return undefined;
	}
	if (isDashboardPath(pathname)) {
		return undefined;
	}
	const isMarkdownPath = pathname.endsWith(".md");
	const wantsMarkdown = (request.headers.get("accept") ?? "").includes("text/markdown");

	if (wantsMarkdown && !isMarkdownPath) {
		const target = new URL(url);
		target.pathname = `${pathname === "/" ? "/index" : pathname}.md`;
		return redirectTo(target, 307);
	}
	if (!isMarkdownPath) {
		return undefined;
	}
	const stripped = pathname.slice(0, -3);
	const source = `${stripped === "/index" ? "/" : stripped}${url.search}`;
	const markdownUrl = new URL("/markdown", `http://localhost:${process.env.PORT || url.port || "3000"}`);
	markdownUrl.searchParams.set("source", source);
	// Only what the markdown route reads: no cookies or auth headers reach the self-fetch.
	const headers = new Headers({
		host: request.headers.get("host") ?? url.host,
		"accept-language": request.headers.get("accept-language") ?? "",
		"x-md-source": source,
	});
	// shortcut: self-fetch instead of an internal rewrite, replace once the /markdown server route can be called in-process
	return await fetch(markdownUrl, { headers });
}

function dashboardGate(request: Request, url: URL): Response | undefined {
	if (!isDashboardPath(url.pathname)) {
		return undefined;
	}
	// Cookie-presence check only. Pages re-verify the session server-side, so this must never become an HTTP call.
	if (getSessionCookie(request)) {
		return undefined;
	}
	const loginUrl = new URL("/login", url);
	loginUrl.searchParams.set("redirectTo", `${url.pathname}${url.search}`);
	return redirectTo(loginUrl, 307);
}

type Negotiation = { response?: Response; locale: Locale; setCookie?: string };

/** Geo hint for first-time visitors only. 307, not 308: geo redirects must stay temporary for crawlers. */
function geoNegotiation(request: Request, url: URL): Negotiation | undefined {
	const geoLocale = getLocaleFromCountry(request.headers.get("CF-IPCountry"));
	if (geoLocale === routing.defaultLocale) {
		return undefined;
	}
	const target = new URL(url);
	target.pathname = `/${geoLocale}${url.pathname === "/" ? "" : url.pathname}`;
	return { locale: geoLocale, response: redirectTo(target, 307), setCookie: localeCookieHeader(geoLocale) };
}

function localeRedirect(url: URL, prefixLocale: Locale | null | undefined, locale: Locale): Response | undefined {
	if (prefixLocale === routing.defaultLocale) {
		const target = new URL(url);
		target.pathname = url.pathname.slice(prefixLocale.length + 1) || "/";
		return redirectTo(target, 307);
	}
	if (!prefixLocale && locale !== routing.defaultLocale) {
		const target = new URL(url);
		target.pathname = `/${locale}${url.pathname === "/" ? "" : url.pathname}`;
		return redirectTo(target, 307);
	}
	return undefined;
}

function negotiateLocale(request: Request, url: URL): Negotiation {
	const prefixLocale = getPrefixLocale(url.pathname);
	const cookieValue = readCookie(request, LOCALE_COOKIE);
	const cookieLocale = isLocale(cookieValue) ? cookieValue : undefined;
	const acceptLocale = matchAcceptLanguage(request.headers.get("accept-language"));

	if (!(prefixLocale || cookieLocale || acceptLocale)) {
		const geo = geoNegotiation(request, url);
		if (geo) {
			return geo;
		}
	}

	const locale = prefixLocale ?? cookieLocale ?? acceptLocale ?? routing.defaultLocale;
	const setCookie = needsCookieSync(cookieValue, locale, acceptLocale) ? localeCookieHeader(locale) : undefined;
	return { locale, response: localeRedirect(url, prefixLocale, locale), setCookie };
}

function needsCookieSync(cookieValue: string | undefined, locale: Locale, acceptLocale: Locale | null): boolean {
	if (cookieValue !== undefined) {
		return cookieValue !== locale;
	}
	return (acceptLocale ?? routing.defaultLocale) !== locale;
}

function alternateLinksHeader(url: URL): string {
	const base = process.env.NEXT_PUBLIC_WEB_URL || url.origin;
	const current = getPrefixLocale(url.pathname);
	const unprefixed = current ? url.pathname.slice(current.length + 1) || "/" : url.pathname;
	const hrefFor = (locale: Locale) => {
		const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
		const path = unprefixed === "/" && prefix ? "" : unprefixed;
		return `${base}${prefix}${path}${url.search}`;
	};
	const links = routing.locales.map((locale) => `<${hrefFor(locale)}>; rel="alternate"; hreflang="${locale}"`);
	links.push(`<${hrefFor(routing.defaultLocale)}>; rel="alternate"; hreflang="x-default"`);
	return links.join(", ");
}

function isPassthrough(pathname: string): boolean {
	if (PASSTHROUGH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return true;
	}
	return pathname.includes(".") && !pathname.endsWith(".md") && !pathname.startsWith("/.well-known/");
}

export type EdgeResult = { response?: Response; decorate?: (response: Response) => void };

/**
 * Everything `src/proxy.ts` and `next.config.ts` redirects did before the router runs.
 * Returns a `response` to short-circuit, or a `decorate` hook to add headers to the page response.
 */
export async function handleEdgeRequest(request: Request): Promise<EdgeResult> {
	const url = new URL(request.url);
	const { pathname } = url;

	const wellKnown = gateWellKnown(pathname);
	if (wellKnown.handled) {
		return { response: (await proxyOauthDiscovery(url)) ?? wellKnown.response };
	}
	if (isPassthrough(pathname)) {
		return {};
	}

	const early = legacyRedirect(url) ?? (await markdownResponse(request, url)) ?? dashboardGate(request, url);
	if (early) {
		return { response: early };
	}
	if (pathname.endsWith(".md")) {
		return {};
	}

	const negotiation = negotiateLocale(request, url);
	if (negotiation.response) {
		if (negotiation.setCookie) {
			negotiation.response.headers.append("set-cookie", negotiation.setCookie);
		}
		return { response: negotiation.response };
	}
	return {
		decorate: (response) => {
			if (negotiation.setCookie) {
				response.headers.append("set-cookie", negotiation.setCookie);
			}
			response.headers.set("link", alternateLinksHeader(url));
		},
	};
}
