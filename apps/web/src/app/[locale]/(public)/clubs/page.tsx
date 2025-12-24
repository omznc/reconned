import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ItemList, WithContext } from "schema-dts";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { VerifiedClubIcon } from "@/components/icons";
import JsonLdScript from "@/components/json-ld-script";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const ITEMS_PER_PAGE = 12;

export const dynamic = "force-dynamic";

type ClubSearch = {
	id: string;
	name: string;
	slug: string;
	description: string;
	logo: string;
	verified: boolean;
	location: string;
	member_count: number;
};

export default async function Page(props: PageProps<"/[locale]/clubs">) {
	const [searchParams, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getExtracted();
	const page = Number(searchParams.page) || 1;

	const { data, error } = await apiServer.GET("/api/clubs", {
		params: {
			query: {
				page: String(page),
				perPage: String(ITEMS_PER_PAGE),
			},
		},
	});

	if (error || !data) {
		return <div>{t("Error loading clubs")}</div>;
	}

	const clubs: ClubSearch[] = data.clubs
		.filter((club) => !club.isPrivate)
		.map((club) => ({
			id: club.id,
			name: club.name,
			slug: club.slug ?? "",
			description: club.description ?? "",
			logo: club.logo ?? "",
			verified: club.verified,
			location: club.location ?? "",
			member_count: 0,
		}));

	const total = clubs.length;

	const itemListSchema: WithContext<ItemList> = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: t("Airsoft clubs - RECONNED"),
		description: t(
			"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
		numberOfItems: total,
		itemListElement: clubs.map((club, index) => ({
			"@type": "ListItem",
			position: index + 1 + (page - 1) * ITEMS_PER_PAGE,
			item: {
				"@type": "SportsOrganization",
				"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${club.slug ?? club.id}`,
				name: club.name,
				description: club.description,
				sport: "Airsoft",
				url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${club.slug ?? club.id}`,
				logo: club.logo || undefined,
				address: club.location
					? {
							"@type": "PostalAddress",
							addressLocality: club.location,
						}
					: undefined,
				memberOf: club.verified
					? {
							"@type": "Organization",
							name: "Verified Airsoft Clubs",
						}
					: undefined,
			},
		})),
	};

	return (
		<div className="container py-8 space-y-8 px-4">
			<JsonLdScript data={itemListSchema} />
			<h1 className="text-2xl font-bold">{t("Clubs")}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{clubs.map((club) => (
					<SearchResultCard
						key={club.id}
						type="club"
						image={club.logo}
						title={
							<span className="flex gap-2 items-center">
								{club.name} {club.verified && <VerifiedClubIcon />}
							</span>
						}
						description={club.description}
						href={`/clubs/${club.slug ?? club.id}`}
						badges={[`${club.member_count} ${club.member_count === 1 ? t("member") : t("members")}`]}
						meta={club.location || undefined}
					/>
				))}
			</div>
			<Pagination totalItems={total} itemsPerPage={ITEMS_PER_PAGE} />
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Airsoft clubs - RECONNED"),
		description: t(
			"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
		keywords: t(
			"airsoft clubs, airsoft teams, airsoft club directory, find airsoft club, join airsoft club, airsoft club BiH, airsoft club Bosnia, airsoft club Sarajevo, airsoft club members, airsoft club registration",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Airsoft clubs - RECONNED"),
			description: t(
				"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Airsoft clubs - RECONNED"),
			description: t(
				"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/clubs", locale),
		},
	};
}
