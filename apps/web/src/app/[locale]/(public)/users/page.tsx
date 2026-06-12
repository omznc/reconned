import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { UsersListing } from "@/app/[locale]/(public)/users/_components/users-listing";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createItemListWithUsers } from "@/lib/json-ld";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const ITEMS_PER_PAGE = 12;

export const revalidate = 300;

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
		next: { revalidate: 300 },
	});

	if (error || !data) {
		return <ErrorPage title={t("Error loading users")} />;
	}

	const initialData = {
		users: data.users,
		pagination: data.pagination,
	};

	const itemListSchema = createItemListWithUsers({
		users: data.users.map((user) => ({
			id: user.id,
			slug: user.slug,
			name: user.name,
			image: user.image,
			callsign: user.callsign,
			location: user.location,
			clubMembership: user.clubMembership?.map((membership) => ({
				clubId: membership.club.id,
				clubSlug: membership.club.slug || null,
				clubName: membership.club.name,
			})),
		})),
		page,
		itemsPerPage: ITEMS_PER_PAGE,
		total: data.pagination.total,
		locale,
		name: t("Airsoft players - RECONNED"),
		description: t(
			"The list of all airsoft players on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
	});

	return (
		<>
			<JsonLdScript data={itemListSchema} />
			<UsersListing initialData={initialData} />
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Airsoft Players Directory - Find & Connect with Players on RECONNED"),
		description: t(
			"Browse airsoft player profiles and connect with the community. Find players by location, experience level, and club membership. Build your airsoft network today.",
		),
		keywords: t(
			"airsoft players, airsoft gamers, airsoft community members, find airsoft player, airsoft player profiles, airsoft player BiH, airsoft player Bosnia, airsoft player directory",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Airsoft Players Directory - Find & Connect with Players on RECONNED"),
			description: t(
				"Browse airsoft player profiles and connect with the community. Find players by location, experience level, and club membership. Build your airsoft network today.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/users", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Airsoft Players Directory - Find & Connect with Players on RECONNED"),
			description: t(
				"Browse airsoft player profiles and connect with the community. Find players by location, experience level, and club membership. Build your airsoft network today.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/users", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/users", locale),
		},
	};
}
