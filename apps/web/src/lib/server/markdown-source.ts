const BLOCKED_PREFIXES = ["/api", "/_next", "/markdown"];

/**
 * Resolves the `source` of a markdown request against the local server.
 * Returns null unless the result stays on the base origin and outside the blocked prefixes.
 */
export function resolveMarkdownSource(source: string | null | undefined, base: string): URL | null {
	if (!source?.startsWith("/") || source.includes("\\")) {
		return null;
	}
	let sourceUrl: URL;
	try {
		sourceUrl = new URL(source, base);
	} catch {
		return null;
	}
	// A `.md` source goes through the `.md` rewrite again: `/x.md.md.md` would self-fetch once per suffix.
	if (sourceUrl.origin !== new URL(base).origin || sourceUrl.pathname.endsWith(".md")) {
		return null;
	}
	return BLOCKED_PREFIXES.some((prefix) => sourceUrl.pathname.startsWith(prefix)) ? null : sourceUrl;
}
