import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { ClubOverview } from "@/components/overviews/club-overview";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import {
	createAggregateRating,
	createBreadcrumbList,
	createGeoCoordinates,
	createPostalAddress,
	removeUndefined,
} from "@/lib/json-ld";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export default async function Page(props: PageProps<"/[locale]/clubs/[id]">) {
	const params = await props.params;
	const user = await isAuthenticated();
	const t = await getExtracted();

	const { data: clubData, error: clubError } = await apiServer.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (clubError || !clubData) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	const [membershipData, hasOwnerData, membersData] = await Promise.all([
		user
			? apiServer.GET("/api/clubs/{id}/membership", {
					params: {
						path: {
							id: clubData.id,
						},
					},
				})
			: Promise.resolve({ data: null, error: null }),
		apiServer.GET("/api/clubs/{id}/has-owner", {
			params: {
				path: {
					id: clubData.id,
				},
			},
		}),
		apiServer.GET("/api/clubs/{id}/members", {
			params: {
				path: {
					id: clubData.id,
				},
			},
		}),
	]);

	const club = clubData;

	const isMemberOfClub = !!membershipData?.data?.isMember;
	const hasOwner = hasOwnerData?.data?.hasOwner || false;
	const role = membershipData?.data?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER";
	const userMembership =
		membershipData?.data?.isMember && membershipData?.data?.membership ? membershipData.data.membership : null;

	if (!club) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/clubs/${club.slug || club.id}`;

	let aggregateRating: ReturnType<typeof createAggregateRating> | undefined;
	if (FEATURE_FLAGS.REVIEWS) {
		const reviewsResponse = await apiServer.GET("/api/reviews/{type}/{id}", {
			params: {
				path: {
					type: "club",
					id: club.id,
				},
			},
		});
		if (reviewsResponse.data && reviewsResponse.data.reviews.length > 0) {
			const reviews = reviewsResponse.data.reviews;
			const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
			aggregateRating = createAggregateRating({
				ratingValue: averageRating,
				ratingCount: reviews.length,
			});
		}
	}

	const sportsOrganizationSchema = removeUndefined({
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		"@id": clubUrl,
		name: club.name,
		numberOfEmployees: {
			"@type": "QuantitativeValue",
			value: club._count.members,
		},
		...(club.description && { description: club.description }),
		sport: "Airsoft",
		url: clubUrl,
		...(club.logo && { logo: club.logo }),
		...(club.dateFounded && { foundingDate: club.dateFounded }),
		...(club.location && {
			address: createPostalAddress({
				location: club.location,
				country: "BA",
			}),
		}),
		...(club.latitude &&
			club.longitude && {
				geo: createGeoCoordinates({
					latitude: club.latitude,
					longitude: club.longitude,
				}),
			}),
		...(club.contactEmail || club.contactPhone
			? {
					contactPoint: removeUndefined({
						"@type": "ContactPoint",
						...(club.contactEmail && { email: club.contactEmail }),
						...(club.contactPhone && { telephone: club.contactPhone }),
						contactType: "customer service",
					}),
				}
			: {}),
		...(club.website && { sameAs: [club.website] }),
		...(aggregateRating && { aggregateRating }),
	});

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}` },
		{ name: t("Clubs"), url: `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/clubs` },
		{ name: club.name, url: clubUrl },
	]);

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] pb-8 px-4">
			<JsonLdScript data={sportsOrganizationSchema} />
			<JsonLdScript data={breadcrumbSchema} />
			<ClubOverview
				club={club}
				isManager={isManager}
				isMember={isMemberOfClub}
				currentUserMembership={userMembership}
				hasOwner={hasOwner}
				user={user}
				members={membersData?.data?.members || []}
				privateCount={membersData?.data?.privateCount || 0}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/clubs/[id]">): Promise<Metadata> {
	const [params, locale] = await Promise.all([props.params, getLocale()]);
	const t = await getExtracted();

	const { data: club, error } = await apiServer.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !club) {
		return {
			title: "Club not found.",
		};
	}

	const pathPrefix = "/clubs";
	const slugOrId = club.slug || club.id;
	const canonicalUrl = constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", `${pathPrefix}/${slugOrId}`, locale);

	return {
		title: `${club.name} - RECONNED`,
		description:
			club.description?.slice(0, 160) ||
			t(
				"The list of all airsoft clubs on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(
				env.NEXT_PUBLIC_WEB_URL || "",
				pathPrefix,
				club.id,
				locale,
				club.slug || undefined,
			),
		},
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
	};
}
