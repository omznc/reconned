import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtracted, getLocale } from "next-intl/server";
import type { SportsOrganization, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { ClubOverview } from "@/components/overviews/club-overview";
import apiClient from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export default async function Page(props: PageProps<"/[locale]/clubs/[id]">) {
	const params = await props.params;
	const user = await isAuthenticated();

	const { data: clubData, error: clubError } = await apiClient.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (clubError || !clubData) {
		notFound();
	}

	const [membershipData, hasOwnerData, managedClubsData] = await Promise.all([
		user
			? apiClient.GET("/api/clubs/{id}/membership", {
					params: {
						path: {
							id: clubData.id,
						},
					},
				})
			: Promise.resolve({ data: null, error: null }),
		apiClient.GET("/api/clubs/{id}/has-owner", {
			params: {
				path: {
					id: clubData.id,
				},
			},
		}),
		user ? apiClient.GET("/api/clubs/managed") : Promise.resolve({ data: { clubs: [] }, error: null }),
	]);

	const club = clubData;

	const isMemberOfClub = !!membershipData?.data?.isMember;
	const hasOwner = hasOwnerData?.data?.hasOwner ?? false;
	const managedClubs = managedClubsData?.data?.clubs.map((club) => club.id) ?? [];
	const userMembership =
		membershipData?.data?.isMember && membershipData?.data?.membership ? membershipData.data.membership : null;

	if (!club) {
		notFound();
	}

	const sportsOrganizationSchema: WithContext<SportsOrganization> = {
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/clubs/${club.slug ?? club.id}`,
		name: club.name,
		numberOfEmployees: {
			"@type": "QuantitativeValue",
			value: club._count.members,
		},
		description: club.description || undefined,
		sport: "Airsoft",
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${params.locale}/clubs/${club.slug ?? club.id}`,
		logo: club.logo || undefined,
		foundingDate: club.dateFounded ?? undefined,
		address: club.location
			? {
					"@type": "PostalAddress",
					addressLocality: club.location,
					addressCountry: "BA",
				}
			: undefined,
		...(club.latitude && club.longitude
			? {
					geo: {
						"@type": "GeoCoordinates",
						latitude: club.latitude,
						longitude: club.longitude,
					},
				}
			: {}),
		contactPoint:
			club.contactEmail || club.contactPhone
				? {
						"@type": "ContactPoint",
						email: club.contactEmail || undefined,
						telephone: club.contactPhone || undefined,
						contactType: "customer service",
					}
				: undefined,
		sameAs: club.website ? [club.website] : undefined,
		aggregateRating: club.verified
			? {
					"@type": "AggregateRating",
					ratingValue: "5",
					ratingCount: "1",
					bestRating: "5",
					worstRating: "1",
				}
			: undefined,
	};

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] pb-8 px-4">
			<JsonLdScript data={sportsOrganizationSchema} />
			<ClubOverview
				club={club}
				isManager={managedClubs.includes(club.id)}
				isMember={isMemberOfClub}
				currentUserMembership={userMembership}
				hasOwner={hasOwner}
				user={user}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/clubs/[id]">): Promise<Metadata> {
	const [params, locale] = await Promise.all([props.params, getLocale()]);
	const t = await getExtracted();

	const { data: club, error } = await apiClient.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !club) {
		notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/club`);
	ogUrl.searchParams.set("name", club.name);
	if (club.description) {
		ogUrl.searchParams.set("description", club.description);
	}
	if (club.logo) {
		ogUrl.searchParams.set("logo", club.logo);
	}

	const pathPrefix = "/clubs";
	const slugOrId = club.slug || club.id;
	const canonicalUrl = constructCanonicalUrl(
		env.NEXT_PUBLIC_BETTER_AUTH_URL || "",
		`${pathPrefix}/${slugOrId}`,
		locale,
	);

	return {
		title: `${club.name} - RECONNED`,
		description:
			club.description?.slice(0, 160) ??
			t(
				"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(
				env.NEXT_PUBLIC_BETTER_AUTH_URL || "",
				pathPrefix,
				club.id,
				locale,
				club.slug || undefined,
			),
		},
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: club.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
	};
}
