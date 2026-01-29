import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { ClubOverview } from "@/components/overviews/club-overview";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
	createAggregateRating,
	createBreadcrumbList,
	createFAQPage,
	createGeoCoordinates,
	createPostalAddress,
	createReviewSchema,
	removeUndefined,
} from "@/lib/json-ld";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const revalidate = 3600;

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
	type ReviewsDataType = ApiResponse<"/api/reviews/{type}/{id}", "get">;
	let reviewsResponse: ReviewsDataType | undefined;
	const reviewsEnabled = await isFeatureEnabled("REVIEWS");
	if (reviewsEnabled) {
		const response = await apiServer.GET("/api/reviews/{type}/{id}", {
			params: {
				path: {
					type: "club",
					id: club.id,
				},
			},
		});
		reviewsResponse = response.data;
		if (response.data && response.data.reviews.length > 0) {
			const reviews = response.data.reviews;
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

	const isFaqEnabled = await isFeatureEnabled("FAQ_SCHEMA");

	// Generate FAQ schema for club
	let faqSchema: ReturnType<typeof createFAQPage> | undefined;
	if (isFaqEnabled) {
		const faqs = [
			{
				question: t("How do I join this club?"),
				answer: t(
					"Click the 'Join Club' button and fill out the application form. The club managers will review your application.",
				),
			},
			{
				question: t("What are the membership fees?"),
				answer: t(
					"Membership fees vary by club. Contact the club directly for information about membership costs.",
				),
			},
			{
				question: t("Do I need my own equipment?"),
				answer: t(
					"Yes, most clubs require you to have your own airsoft equipment. Some clubs offer rental options for beginners.",
				),
			},
			{
				question: t("How often are events organized?"),
				answer: t(
					"Events are organized regularly throughout the year. Check the club's event page for upcoming activities.",
				),
			},
		];
		faqSchema = createFAQPage({
			faqs,
			name: club.name,
			description: club.description || undefined,
		});
	}

	// Generate review schema
	let reviewSchema: ReturnType<typeof createReviewSchema> | undefined;
	if (reviewsEnabled && reviewsResponse?.reviews) {
		const reviews = reviewsResponse.reviews;
		if (reviews.length > 0) {
			reviewSchema = createReviewSchema({
				reviews: reviews.map((review) => ({
					author: review.author?.name || t("Anonymous"),
					rating: review.rating,
					content: review.content || "",
					datePublished: new Date(review.createdAt).toISOString(),
				})),
				itemReviewed: club.name,
				itemReviewedType: "SportsOrganization",
			});
		}
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] pb-8 px-4">
			<JsonLdScript data={sportsOrganizationSchema} />
			<JsonLdScript data={breadcrumbSchema} />
			{faqSchema && <JsonLdScript data={faqSchema} />}
			{reviewSchema && <JsonLdScript data={reviewSchema} />}
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
