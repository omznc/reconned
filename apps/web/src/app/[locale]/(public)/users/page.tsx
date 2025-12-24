import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ItemList, WithContext } from "schema-dts";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { AdminIcon } from "@/components/icons";
import JsonLdScript from "@/components/json-ld-script";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const ITEMS_PER_PAGE = 12;

export const dynamic = "force-dynamic";

export default async function Page(props: PageProps<"/[locale]/users">) {
	const [searchParams, locale] = await Promise.all([props.searchParams, getLocale()]);
	const t = await getExtracted();
	const page = Number(searchParams.page) || 1;

	const { data, error } = await apiServer.GET("/api/users", {
		params: {
			query: {
				page: String(page),
				perPage: String(ITEMS_PER_PAGE),
				sort: "admin",
			},
		},
	});

	if (error || !data) {
		return <div>{t("Error loading users")}</div>;
	}

	const users = data.users;
	const total = data.pagination.total;
	const skip = (page - 1) * ITEMS_PER_PAGE;

	const itemListSchema: WithContext<ItemList> = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: t("Airsoft players - RECONNED"),
		description: t(
			"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
		numberOfItems: total,
		itemListElement: users.map((user, index) => ({
			"@type": "ListItem",
			position: index + 1 + skip,
			item: {
				"@type": "Person",
				"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/users/${user.slug ?? user.id}`,
				name: user.name,
				url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/users/${user.slug ?? user.id}`,
				image: user.image || undefined,
				address: user.location
					? {
							"@type": "PostalAddress",
							addressLocality: user.location,
						}
					: undefined,
				additionalName: user.callsign || undefined,
				jobTitle: user.isAdmin ? "Administrator" : undefined,
			},
		})),
	};

	return (
		<div className="container py-8 space-y-8 px-4">
			<JsonLdScript data={itemListSchema} />
			<h1 className="text-2xl font-bold">{t("Players")}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{users.map((user) => (
					<SearchResultCard
						key={user.id}
						type="user"
						image={user.image}
						title={
							<span className="flex gap-2 items-center">
								{user.name} {user.callsign ? `(${user.callsign})` : ""}
								{user.isAdmin && <AdminIcon />}
							</span>
						}
						description={null}
						href={`/users/${user.slug ?? user.id}`}
						meta={user.location || undefined}
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
		title: t("Airsoft players - RECONNED"),
		description: t(
			"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
		keywords: t(
			"airsoft players, airsoft gamers, airsoft community members, find airsoft player, airsoft player profiles, airsoft player BiH, airsoft player Bosnia, airsoft player directory",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Airsoft players - RECONNED"),
			description: t(
				"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/users", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Airsoft players - RECONNED"),
			description: t(
				"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/users", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/users", locale),
		},
	};
}
