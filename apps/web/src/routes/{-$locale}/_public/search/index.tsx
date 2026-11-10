import { createFileRoute } from "@tanstack/react-router";
import { getExtracted } from "next-intl/server";
import type { SearchResultsPage, WithContext } from "schema-dts";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { env } from "@/lib/env";
import { buildSeoHead } from "@/lib/seo";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";
import { SearchPage } from "@/routes/{-$locale}/_public/search/-components/search-page";

/** `?q=a&q=b` parses to an array and `?q=123` to a number; the rest of the page treats the query as a plain string. */
function toQuery(value: unknown): string {
	const first = Array.isArray(value) ? value[0] : value;
	return typeof first === "string" || typeof first === "number" ? String(first) : "";
}

async function loadSearchSeo(q: string, locale: string) {
	const t = await getExtracted({ locale });
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
	const path = `/search${q ? `?q=${encodeURIComponent(q)}` : ""}`;
	const pageUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}${path}`;

	const searchSchema: WithContext<SearchResultsPage> = {
		"@context": "https://schema.org",
		"@type": "SearchResultsPage",
		"@id": pageUrl,
		name: t("Search for {query} - RECONNED", { query: q }),
		description: t(
			"Search results for {query}. Search for clubs, players, and events on the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
			{ query: q },
		),
		url: pageUrl,
		mainEntity: {
			"@type": "WebSite",
			"@id": env.NEXT_PUBLIC_WEB_URL,
			name: "Reconned",
			url: env.NEXT_PUBLIC_WEB_URL,
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/search?q={search_term_string}`,
				},
				"query-input": "required name=search_term_string",
				// biome-ignore lint/suspicious/noExplicitAny: Idk how else to get this to work
			} as any,
		},
		about: q
			? {
					"@type": "Thing",
					name: q,
					description: `Search results for: ${q}`,
				}
			: undefined,
	};

	return {
		title: q
			? t("Search Results for {query} on RECONNED", { query: q })
			: t("Search Airsoft Clubs, Events & Players on RECONNED"),
		description: q
			? t(
					'Search results for "{query}" on RECONNED. Find airsoft clubs, events, and players matching your search. Connect with the airsoft community in Bosnia and Herzegovina.',
					{ query: q },
				)
			: t(
					"Search the comprehensive airsoft database. Find clubs, events, and players across Bosnia and Herzegovina. Use filters to narrow down results by location, type, and more.",
				),
		keywords: t(
			"search airsoft, find airsoft clubs, find airsoft players, find airsoft events, airsoft search, airsoft directory, airsoft community search",
		)
			.split(",")
			.map((keyword: string) => keyword.trim())
			.join(", "),
		canonical: constructCanonicalUrl(baseUrl, path, locale),
		languages: generatePageLanguages(baseUrl, path, locale),
		schemas: [JSON.stringify(searchSchema)],
	};
}

export const Route = createFileRoute("/{-$locale}/_public/search/")({
	validateSearch: (search: Record<string, unknown>) => ({ ...search, q: toQuery(search.q) || undefined }),
	loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
	loader: ({ deps, context }) => loadSearchSeo(deps.q, context.locale),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: SearchPage,
});
