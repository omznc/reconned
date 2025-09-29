import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ItemList, WithContext } from "schema-dts";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { VerifiedClubIcon } from "@/components/icons";
import JsonLdScript from "@/components/json-ld-script";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const ITEMS_PER_PAGE = 12;

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

export default async function Page(props: { searchParams: Promise<{ page?: string }> }) {
	const searchParams = await props.searchParams;
	const t = await getTranslations();
	const page = Number(searchParams.page) || 1;
	const skip = (page - 1) * ITEMS_PER_PAGE;

	const total = await prisma.club.count({
		where: { isPrivate: false },
	});

	const clubs: ClubSearch[] = await prisma.$queryRaw`
		SELECT c.id, c.name, c.slug, c.description, c.logo, c.verified, c.location, COUNT(cm.id) as member_count
		FROM "Club" c
		LEFT JOIN "ClubMembership" cm ON c.id = cm."clubId"
		WHERE c."isPrivate" = false
		GROUP BY c.id
		ORDER BY 
			c.verified DESC,
			COUNT(cm.id) DESC
		LIMIT ${ITEMS_PER_PAGE}
		OFFSET ${skip}
	`;

	const itemListSchema: WithContext<ItemList> = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: t("public.clubs.metadata.title"),
		description: t("public.clubs.metadata.description"),
		numberOfItems: total,
		itemListElement: clubs.map((club, index) => ({
			"@type": "ListItem",
			position: index + 1 + skip,
			item: {
				"@type": "SportsOrganization",
				"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug ?? club.id}`,
				name: club.name,
				description: club.description,
				sport: "Airsoft",
				url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug ?? club.id}`,
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
		<div className="container max-w-4xl py-8 space-y-8 px-4">
			<JsonLdScript data={itemListSchema} />
			<h1 className="text-2xl font-bold">{t("public.clubs.title")}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
						badges={[
							`${club.member_count} ${club.member_count === 1 ? t("public.clubs.member") : t("public.clubs.members")}`,
						]}
						meta={club.location || undefined}
					/>
				))}
			</div>
			<Pagination totalItems={total} itemsPerPage={ITEMS_PER_PAGE} />
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations();

	return {
		title: t("public.clubs.metadata.title"),
		description: t("public.clubs.metadata.description"),
		keywords: t("public.layout.metadata.keywords")
			.split(",")
			.map((keyword) => keyword.trim()),
		alternates: {
			canonical: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs`,
		},
	};
}
