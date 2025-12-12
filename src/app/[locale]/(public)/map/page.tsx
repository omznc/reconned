import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { CollectionPage, WithContext } from "schema-dts";
import { ClubsMapWrapper } from "@/components/clubs-map/clubs-map-wrapper";
import JsonLdScript from "@/components/json-ld-script";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export default async function MapPage() {
	const clubs = await prisma.club.findMany({
		where: {
			isPrivate: false,
			latitude: { not: null },
			longitude: { not: null },
		},
		select: {
			id: true,
			name: true,
			logo: true,
			latitude: true,
			longitude: true,
			slug: true,
			location: true,
		},
	});

	const transformedClubs = clubs.map((club) => ({
		...club,
		location: club.location ?? undefined,
		slug: club.slug ?? undefined,
		logo: club.logo ?? undefined,
	}));

	const t = await getExtracted();

	const mapSchema: WithContext<CollectionPage> = {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/map`,
		name: t("Club Map - RECONNED"),
		description: t(
			"Find where our airsoft clubs are located. Explore and find communities close to you. The first universal platform for airsoft clubs, events, and players.",
		),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/map`,
		mainEntity: {
			"@type": "ItemList",
			name: "Airsoft Clubs Map",
			description: "Interactive map showing airsoft club locations",
			itemListElement: clubs.map((club, index) => ({
				"@type": "ListItem",
				position: index + 1,
				item: {
					"@type": "SportsOrganization",
					"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug ?? club.id}`,
					name: club.name,
					sport: "Airsoft",
					url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/clubs/${club.slug ?? club.id}`,
					logo: club.logo || undefined,
					address: club.location
						? {
								"@type": "PostalAddress",
								addressLocality: club.location,
							}
						: undefined,
					geo:
						club.latitude && club.longitude
							? {
									"@type": "GeoCoordinates",
									latitude: club.latitude,
									longitude: club.longitude,
								}
							: undefined,
				},
			})),
		},
	};

	return (
		<div className="h-[calc(100dvh-72px)] w-full rounded-lg overflow-hidden border">
			<JsonLdScript data={mapSchema} />
			<ClubsMapWrapper clubs={transformedClubs} />
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Club Map - RECONNED"),
		description: t(
			"Find where our airsoft clubs are located. Explore and find communities close to you. The first universal platform for airsoft clubs, events, and players.",
		),
		openGraph: {
			title: t("Club Map - RECONNED"),
			description: t(
				"Find where our airsoft clubs are located. Explore and find communities close to you. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/map", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Club Map - RECONNED"),
			description: t(
				"Find where our airsoft clubs are located. Explore and find communities close to you. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/map", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/map", locale),
		},
		keywords: t(
			"airsoft clubs map bih,airsoft clubs map, airsoft clubs Bosnia and Herzegovina, airsoft clubs BiH, airsoft clubs Sarajevo, airsoft map, airsoft teams, airsoft communities, airsoft federation, airsoft savez, airsoft associations, airsoft locations, find airsoft club, airsoft clubs, airsoft club locator, airsoft club registration, airsoft club map, airsoft club join",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
	};
}
