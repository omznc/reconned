import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ItemList, WithContext } from "schema-dts";
import { Pagination } from "@/app/[locale]/(public)/_components/pagination";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { AdminIcon } from "@/components/icons";
import JsonLdScript from "@/components/json-ld-script";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

type UserSearch = {
	id: string;
	name: string;
	slug: string;
	image: string;
	role: string;
	callsign: string;
	location: string;
};

const ITEMS_PER_PAGE = 12;

export const dynamic = "force-dynamic";

export default async function Page(props: PageProps<"/[locale]/users">) {
	const [searchParams, t, locale] = await Promise.all([props.searchParams, getTranslations(), getLocale()]);
	const page = Number(searchParams.page) || 1;
	const skip = (page - 1) * ITEMS_PER_PAGE;

	const total = await prisma.user.count({
		where: { isPrivate: false },
	});

	const users: UserSearch[] = await prisma.$queryRaw`
        SELECT *
        FROM "User"
        WHERE "isPrivate" = false
        ORDER BY 
            CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
            "createdAt" DESC
        LIMIT ${ITEMS_PER_PAGE}
        OFFSET ${skip}
    `;

	const itemListSchema: WithContext<ItemList> = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: t("public.users.metadata.title"),
		description: t("public.users.metadata.description"),
		numberOfItems: total,
		itemListElement: users.map((user, index) => ({
			"@type": "ListItem",
			position: index + 1 + skip,
			item: {
				"@type": "Person",
				"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/users/${user.slug ?? user.id}`,
				name: user.name,
				url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/users/${user.slug ?? user.id}`,
				image: user.image || undefined,
				address: user.location
					? {
							"@type": "PostalAddress",
							addressLocality: user.location,
						}
					: undefined,
				additionalName: user.callsign || undefined,
				jobTitle: user.role === "admin" ? "Administrator" : undefined,
			},
		})),
	};

	return (
		<div className="container py-8 space-y-8 px-4">
			<JsonLdScript data={itemListSchema} />
			<h1 className="text-2xl font-bold">{t("public.users.title")}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{users.map((user) => (
					<SearchResultCard
						key={user.id}
						type="user"
						image={user.image}
						title={
							<span className="flex gap-2 items-center">
								{user.name} {user.callsign ? `(${user.callsign})` : ""}
								{user.role === "admin" && <AdminIcon />}
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
	const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

	return {
		title: t("public.users.metadata.title"),
		description: t("public.users.metadata.description"),
		keywords: t("public.users.metadata.keywords")
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("public.users.metadata.title"),
			description: t("public.users.metadata.description"),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/users", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("public.users.metadata.title"),
			description: t("public.users.metadata.description"),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/users", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/users", locale),
		},
	};
}
