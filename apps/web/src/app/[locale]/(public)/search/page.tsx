import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { SearchResultsPage, WithContext } from "schema-dts";
import { Search } from "@/app/[locale]/(public)/search/_components/search";
import { SearchResults } from "@/app/[locale]/(public)/search/_components/search-results";
import JsonLdScript from "@/components/json-ld-script";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export default async function SearchPage(props: PageProps<"/[locale]/search">) {
	const [{ q }, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getExtracted();

	const searchSchema: WithContext<SearchResultsPage> = {
		"@context": "https://schema.org",
		"@type": "SearchResultsPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
		name: t("Search for {query} - RECONNED", { query: q }),
		description: t(
			"Search results for {query}. Search for clubs, players, and events on the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
			{ query: q },
		),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search${q ? `?q=${encodeURIComponent(q)}` : ""}`,
		mainEntity: {
			"@type": "WebSite",
			"@id": env.NEXT_PUBLIC_BETTER_AUTH_URL,
			name: "Reconned",
			url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
			potentialAction: {
				"@type": "SearchAction",
				target: {
					"@type": "EntryPoint",
					urlTemplate: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/search?q={search_term_string}`,
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

	return (
		<div className="container max-w-4xl py-8 space-y-8 px-4">
			<JsonLdScript data={searchSchema} />
			<div>
				<h1 className="text-4xl font-bold mb-2">{t("Search")}</h1>
				<p className="text-muted-foreground">{t("Find clubs, players, and events - all in one place")}</p>
			</div>

			<div className="w-full">
				<Search />
			</div>

			<SearchResults />
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/search">): Promise<Metadata> {
	const [{ q }, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getExtracted();

	const path = `/search${q ? `?q=${encodeURIComponent(q)}` : ""}`;

	return {
		title: t("Search for {query} - RECONNED", {
			query: q,
		}),
		description: t(
			"Search results for {query}. Search for clubs, players, and events on the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
			{
				query: q,
			},
		),
		keywords: t(
			"search airsoft, find airsoft clubs, find airsoft players, find airsoft events, airsoft search, airsoft directory, airsoft community search",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Search for {query} - RECONNED", { query: q }),
			description: t(
				"Search results for {query}. Search for clubs, players, and events on the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
				{ query: q },
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", path, locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Search for {query} - RECONNED", { query: q }),
			description: t(
				"Search results for {query}. Search for clubs, players, and events on the RECONNED platform. The first universal platform for airsoft clubs, events, and players.",
				{ query: q },
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", path, locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", path, locale),
		},
	};
}
