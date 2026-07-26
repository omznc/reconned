import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

export function GET() {
	const baseUrl = env.NEXT_PUBLIC_WEB_URL.replace(/\/$/, "");
	const localeInfo = routing.locales.join(", ");
	const defaultLocale = routing.defaultLocale;

	const body = [
		"# RECONNED",
		"",
		"> RECONNED is an airsoft club and event platform.",
		"> It lists verified airsoft clubs, events, players, and field maps.",
		"> Built for Bosnia and Herzegovina, usable worldwide.",
		"",
		`Available in ${routing.locales.length} languages: ${localeInfo}. Default: ${defaultLocale}.`,
		`Locale-prefixed paths (e.g., ${baseUrl}/en/clubs) switch language.`,
		"Omit the prefix for the default locale.",
		"",
		"Any public page is also available as markdown: append `.md` to its path",
		`(e.g., ${baseUrl}/en/clubs.md), or send \`Accept: text/markdown\`.`,
		"",
		`For a full inventory of every club and event, see ${baseUrl}/llms-full.txt.`,
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
		"## About",
		"",
		`- [Home](${baseUrl}/en): Platform overview`,
		`- [Sponsors](${baseUrl}/en/sponsors): RECONNED sponsors`,
		`- [Support Us](${baseUrl}/en/support-us): How to support the platform`,
		`- [Developers](${baseUrl}/en/developers): API documentation and developer resources`,
		"",
		"## Optional",
		"",
		`- [Privacy Policy](${baseUrl}/en/privacy-policy)`,
		`- [Terms of Use](${baseUrl}/en/terms-of-use)`,
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}
