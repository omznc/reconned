import { Logger } from "next-axiom";
import { routing } from "@/i18n/routing";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";

export const revalidate = 3600;

const logger = new Logger({ source: "llms-full.txt" });

/**
 * The expanded companion to `llms.txt`: the same orientation, plus an actual
 * inventory of the clubs and events on the platform, so a model that fetches one
 * file comes away knowing what is here rather than only which sections exist.
 *
 * Sourced from `/api/public/llms`, not the paginated `/api/clubs` list: that route
 * is `varyByUser` and the API client forwards the caller's session cookie, so
 * building a publicly-cached file from it could bake private clubs into a shared
 * response. The public endpoint applies visibility filters with no session at all.
 */
export async function GET() {
	const baseUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");

	// Mirrors sitemap.ts: connection-level failures must degrade to a smaller file,
	// never a 500 — this is a prerendered route and an agent-facing index is not
	// worth failing a deploy over.
	const onUnreachable = (label: string) => (cause: unknown) => {
		logger.error("Could not reach the API for llms-full data", { error: cause, section: label });
		return { data: undefined, error: cause };
	};

	const [inventory, cityIndex] = await Promise.all([
		apiServer.GET("/api/public/llms", { next: { revalidate: 3600 } }).catch(onUnreachable("llms")),
		apiServer.GET("/api/public/cities", { next: { revalidate: 3600 } }).catch(onUnreachable("cities")),
	]);

	if (inventory.error) {
		logger.error("Error fetching llms-full data", { error: inventory.error });
	}
	if (cityIndex.error) {
		logger.error("Error fetching llms-full city data", { error: cityIndex.error });
	}

	const clubs = inventory.data?.clubs ?? [];
	const events = inventory.data?.events ?? [];
	const cities = cityIndex.data?.cities ?? [];

	const now = new Date();
	const upcoming = events.filter((event) => new Date(event.dateEnd ?? event.dateStart) >= now);
	const past = events.filter((event) => new Date(event.dateEnd ?? event.dateStart) < now);

	const clubUrl = (club: { slug: string | null; id: string }) => `${baseUrl}/en/clubs/${club.slug || club.id}`;
	const eventUrl = (event: { slug: string | null; id: string }) => `${baseUrl}/en/events/${event.slug || event.id}`;

	const formatDate = (value: string) => new Date(value).toISOString().slice(0, 10);

	const describe = (parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" — ");

	const lines: string[] = [
		"# RECONNED",
		"",
		"> RECONNED is an airsoft club and event platform.",
		"> It lists verified airsoft clubs, events, players, and field maps.",
		"> Built for Bosnia and Herzegovina, usable worldwide.",
		"",
		`Available in ${routing.locales.length} languages: ${routing.locales.join(", ")}. Default: ${routing.defaultLocale}.`,
		`Locale-prefixed paths (e.g., ${baseUrl}/en/clubs) switch language.`,
		"Omit the prefix for the default locale.",
		"",
		"Any public page is also available as markdown: append `.md` to its path",
		`(e.g., ${baseUrl}/en/clubs.md), or send \`Accept: text/markdown\`.`,
		"",
		"A REST API and an MCP server are documented at",
		`${baseUrl}/.well-known/api-catalog and ${baseUrl}/.well-known/mcp.json.`,
		"",
		"## Core",
		"",
		`- [Clubs](${baseUrl}/en/clubs): Browse all registered airsoft clubs`,
		`- [Clubs by city](${baseUrl}/en/clubs/city): Clubs grouped by the city they are based in`,
		`- [Events](${baseUrl}/en/events): Upcoming and past airsoft events`,
		`- [Players](${baseUrl}/en/users): Public player profiles`,
		`- [Search](${baseUrl}/en/search): Search across clubs, events, and players`,
		`- [Map](${baseUrl}/en/map): Interactive map of airsoft fields and clubs`,
		"",
	];

	// Only cities with more than one club get a landing page, so this list is a
	// subset of where clubs actually are — it is a map of the city pages that
	// exist, not a complete geographic breakdown.
	if (cities.length > 0) {
		lines.push(`## Cities (${cities.length})`, "");
		for (const city of cities) {
			const label = city.clubCount === 1 ? "1 club" : `${city.clubCount} clubs`;
			lines.push(`- [${city.city}](${baseUrl}/en/clubs/city/${city.citySlug}): ${label}`);
		}
		lines.push("");
	}

	lines.push(`## Clubs (${clubs.length})`, "");

	if (clubs.length === 0) {
		lines.push("_No public clubs are currently listed._", "");
	} else {
		for (const club of clubs) {
			const meta = describe([club.location, club.verified ? "verified" : null, club.description]);
			lines.push(`- [${club.name}](${clubUrl(club)})${meta ? `: ${meta}` : ""}`);
		}
		lines.push("");
	}

	lines.push(`## Upcoming events (${upcoming.length})`, "");
	if (upcoming.length === 0) {
		lines.push("_No upcoming public events are currently listed._", "");
	} else {
		for (const event of upcoming) {
			const meta = describe([formatDate(event.dateStart), event.location, event.description]);
			lines.push(`- [${event.name}](${eventUrl(event)})${meta ? `: ${meta}` : ""}`);
		}
		lines.push("");
	}

	// Past events are listed newest-first and capped: they are useful evidence that
	// the platform has a history, but the full archive would crowd out everything
	// above it as the event count grows.
	const recentPast = past.slice(-50).reverse();
	if (recentPast.length > 0) {
		lines.push(`## Recent past events (${recentPast.length} of ${past.length})`, "");
		for (const event of recentPast) {
			lines.push(
				`- [${event.name}](${eventUrl(event)}): ${describe([formatDate(event.dateStart), event.location])}`,
			);
		}
		lines.push("");
	}

	lines.push(
		"## Optional",
		"",
		`- [Home](${baseUrl}/en): Platform overview`,
		`- [Sponsors](${baseUrl}/en/sponsors): RECONNED sponsors`,
		`- [Support Us](${baseUrl}/en/support-us): How to support the platform`,
		`- [Developers](${baseUrl}/en/developers): API documentation and developer resources`,
		`- [Privacy Policy](${baseUrl}/en/privacy-policy)`,
		`- [Terms of Use](${baseUrl}/en/terms-of-use)`,
		"",
	);

	return new Response(lines.join("\n"), {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "text/plain; charset=utf-8",
		},
	});
}
