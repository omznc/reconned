const POSTHOG_API_HOST = "eu.i.posthog.com";
const POSTHOG_ASSETS_HOST = "eu-assets.i.posthog.com";
const FORWARDED_REQUEST_HEADERS = ["user-agent", "content-type", "accept", "accept-encoding", "x-forwarded-for"];

/** Builds the PostHog URL for a `/warmind/*` splat. Returns null if the splat could change the host. */
export function buildPosthogTarget(splat: string, search: string): URL | null {
	if (splat.startsWith("/") || splat.includes("\\")) {
		return null;
	}
	const isAsset = splat === "static" || splat.startsWith("static/");
	const origin = `https://${isAsset ? POSTHOG_ASSETS_HOST : POSTHOG_API_HOST}`;
	const target = new URL(origin);
	target.pathname = `/${splat}`;
	target.search = search;
	return target.origin === origin ? target : null;
}

/** Only the headers PostHog needs. Authorization and cookies never leave the site. */
export function posthogRequestHeaders(source: Headers, target: URL): Headers {
	const headers = new Headers();
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = source.get(name);
		if (value) {
			headers.set(name, value);
		}
	}
	headers.set("host", target.host);
	return headers;
}
