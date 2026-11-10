import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { CollectionPage, WithContext } from "schema-dts";
import * as z from "zod";
import { ClubsMapWrapper } from "@/components/clubs-map/clubs-map-wrapper";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { buildSeoHead, type SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

const getMapPageFn = createServerFn({ method: "GET" })
	.validator(z.object({ locale: z.string() }))
	.handler(async ({ data: { locale } }) => {
		const t = await getExtracted({ locale });
		const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
		const seo: SeoInput = {
			title: t("Airsoft Clubs Map - Find Locations Near You on RECONNED"),
			description: t(
				"Explore our interactive map of airsoft clubs across Bosnia and Herzegovina. Find clubs near you, get directions, and connect with local airsoft communities.",
			),
			canonical: constructCanonicalUrl(baseUrl, "/map", locale),
			languages: generatePageLanguages(baseUrl, "/map", locale),
			keywords: t(
				"airsoft clubs map bih,airsoft clubs map, airsoft clubs Bosnia and Herzegovina, airsoft clubs BiH, airsoft clubs Sarajevo, airsoft map, airsoft teams, airsoft communities, airsoft federation, airsoft savez, airsoft associations, airsoft locations, find airsoft club, airsoft clubs, airsoft club locator, airsoft club registration, airsoft club map, airsoft club join",
			)
				.split(",")
				.map((keyword: string) => keyword.trim())
				.join(", "),
		};

		const { data, error } = await apiServer.GET("/api/public/clubs/map");
		if (error || !data) {
			console.error("Error loading clubs:", error);
			return { kind: "error" as const, seo };
		}

		const clubs = data.clubs
			.filter((club) => club.latitude && club.longitude)
			.map((club) => ({
				...club,
				location: club.location || null,
				slug: club.slug || null,
				logo: club.logo || null,
				isPrivate: false,
			}));

		const mapSchema: WithContext<CollectionPage> = {
			"@context": "https://schema.org",
			"@type": "CollectionPage",
			"@id": `${env.NEXT_PUBLIC_WEB_URL}/map`,
			name: t("Club Map - RECONNED"),
			description: t(
				"Find where our airsoft clubs are located. Explore and find communities close to you. The first universal platform for airsoft clubs, events, and players.",
			),
			url: `${env.NEXT_PUBLIC_WEB_URL}/map`,
			mainEntity: {
				"@type": "ItemList",
				name: "Airsoft Clubs Map",
				description: "Interactive map showing airsoft club locations",
				itemListElement: clubs.map((club, index) => ({
					"@type": "ListItem",
					position: index + 1,
					item: {
						"@type": "SportsOrganization",
						"@id": `${env.NEXT_PUBLIC_WEB_URL}/clubs/${club.slug || club.id}`,
						name: club.name,
						sport: "Airsoft",
						url: `${env.NEXT_PUBLIC_WEB_URL}/clubs/${club.slug || club.id}`,
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

		const { data: allCountries } = await apiServer.GET("/api/countries");
		const used = new Set(clubs.map((club) => club.countryId));
		const countries = (allCountries ?? [])
			.filter((country) => used.has(country.id))
			.map((country) => ({
				id: country.id,
				name: (country.translations as Record<string, string> | null)?.[locale] ?? country.name,
			}))
			.sort((a, b) => a.name.localeCompare(b.name, locale));

		return {
			kind: "ok" as const,
			clubs,
			countries,
			seo: { ...seo, schemas: [JSON.stringify(mapSchema)] },
		};
	});

export const Route = createFileRoute("/{-$locale}/_public/map")({
	loader: ({ context }) => getMapPageFn({ data: { locale: context.locale } }),
	head: ({ loaderData }) => (loaderData ? buildSeoHead(loaderData.seo) : {}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: MapPage,
});

function MapPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (page.kind === "error") {
		return <ErrorPage title="Error loading clubs" link="/" />;
	}

	return (
		<div data-map-page={true} className="fixed top-0 left-0 z-40 h-dvh w-full">
			<h1 className="sr-only">{t("Airsoft Clubs Map")}</h1>
			<ClubsMapWrapper clubs={page.clubs} countries={page.countries} controlsBelowHeader={true} />
		</div>
	);
}
