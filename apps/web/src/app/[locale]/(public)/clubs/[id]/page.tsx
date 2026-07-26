import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtracted, setRequestLocale } from "next-intl/server";
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
	createWebPageSchema,
	removeUndefined,
} from "@/lib/json-ld";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const revalidate = 3600;

export default async function Page(props: PageProps<"/[locale]/clubs/[id]">) {
	const [params, user] = await Promise.all([props.params, isAuthenticated()]);
	setRequestLocale(params.locale);
	// `await getExtracted()` must stay in this exact `const x = await ...` form — the next-intl SWC
	// plugin only rewrites that shape, and leaves a bare `getExtracted` identifier anywhere else.
	const t = await getExtracted();

	const {
		data: clubData,
		error: clubError,
		response: clubResponse,
	} = await apiServer.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
		next: { revalidate: 3600 },
	});

	// A missing club must answer 404, not a 200 page that says "not found" — a soft
	// 404 keeps deleted and mistyped club URLs in the index as duplicate thin
	// content. A backend failure is a different thing entirely and stays a rendered
	// error, so an outage never tells crawlers that real clubs are gone.
	if (clubResponse.status === 404) {
		notFound();
	}
	if (clubError || !clubData) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	type ReviewsDataType = ApiResponse<"/api/reviews/{type}/{id}", "get">;

	const [
		{ data: membershipData },
		{ data: hasOwnerData },
		{ data: membersData },
		postsData,
		alliancesData,
		instagramMediaData,
		invitesData,
		reviewsEnabled,
		reviewsResponse,
		isFaqEnabled,
	] = await Promise.all([
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
			next: { revalidate: 3600 },
		}),
		apiServer.GET("/api/clubs/{id}/members", {
			params: {
				path: {
					id: clubData.id,
				},
			},
			next: { revalidate: 3600 },
		}),
		apiServer.GET("/api/clubs/{id}/posts", {
			params: {
				path: { id: clubData.id },
			},
			next: { revalidate: 300 },
		}),
		apiServer.GET("/api/clubs/{id}/alliances", {
			params: {
				path: { id: clubData.id },
			},
			next: { revalidate: 3600 },
		}),
		clubData.instagramConnected
			? apiServer.GET("/api/clubs/{id}/instagram/media", {
					params: {
						path: { id: clubData.id },
						query: { limit: 20 },
					},
				})
			: Promise.resolve({ data: null, error: null }),
		// Per-user data: must never enter Next's shared data cache, since the API
		// client forwards the caller's auth cookie.
		user
			? apiServer.GET("/api/users/invites", {
					cache: "no-store",
				})
			: Promise.resolve({ data: null, error: null }),
		isFeatureEnabled("REVIEWS"),
		// The flag check runs in parallel with the batch above; the reviews fetch
		// depends on it, so it is chained rather than awaited separately later.
		isFeatureEnabled("REVIEWS").then(async (enabled): Promise<ReviewsDataType | undefined> => {
			if (!enabled) {
				return undefined;
			}
			const response = await apiServer.GET("/api/reviews/{type}/{id}", {
				params: {
					path: {
						type: "club",
						id: clubData.id,
					},
				},
				next: { revalidate: 3600 },
			});
			return response.data;
		}),
		isFeatureEnabled("FAQ_SCHEMA"),
	]);

	const club = clubData;

	const isMemberOfClub = !!membershipData?.isMember;
	const hasOwner = hasOwnerData?.hasOwner || false;
	const role = membershipData?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER";
	const userMembership = membershipData?.isMember && membershipData?.membership ? membershipData.membership : null;

	if (!club) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	const inviteData = invitesData?.data?.invites || [];
	const clubInvites = inviteData.filter((invite: { clubId: string }) => invite.clubId === club.id);
	const posts = postsData?.data?.posts || [];
	const alliances = alliancesData?.data?.alliances || [];
	const instagramData = instagramMediaData?.data || {
		media: [],
		username: club.instagramUsername || null,
	};

	const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${params.locale}/clubs/${club.slug || club.id}`;

	let aggregateRating: ReturnType<typeof createAggregateRating> | undefined;
	if (reviewsResponse && reviewsResponse.reviews.length > 0) {
		const reviews = reviewsResponse.reviews;
		const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
		aggregateRating = createAggregateRating({
			ratingValue: averageRating,
			ratingCount: reviews.length,
		});
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

	const webPageSchema = createWebPageSchema({
		pageUrl: clubUrl,
		name: club.name,
		dateModified: club.updatedAt,
		datePublished: club.createdAt,
	});

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8 px-4">
			<JsonLdScript data={sportsOrganizationSchema} />
			<JsonLdScript data={webPageSchema} />
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
				members={membersData?.members || []}
				privateCount={membersData?.privateCount || 0}
				posts={posts}
				alliances={alliances}
				instagramData={instagramData}
				invites={clubInvites}
			/>
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/clubs/[id]">): Promise<Metadata> {
	const params = await props.params;
	const { locale } = params;

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

	const clubKeywords = [
		"airsoft club",
		"airsoft team",
		"verified airsoft club",
		"airsoft club BiH",
		"airsoft club Bosnia",
		club.name,
		club.location ? `airsoft club ${club.location}` : null,
		club.location || null,
		...(club.verified ? ["verified airsoft team", "official airsoft club"] : []),
	]
		.filter(Boolean)
		.join(", ");

	const description = club.description
		? club.description.length > 150
			? `${club.description.slice(0, 147)}...`
			: club.description
		: `${club.name} is an airsoft club${club.location ? ` in ${club.location}` : ""}.${club.verified ? " Verified airsoft club on RECONNED." : ""}`;

	return {
		title: `${club.name} - RECONNED`,
		description,
		keywords: clubKeywords,
		openGraph: {
			title: `${club.name} - RECONNED`,
			description,
			type: "website",
			url: canonicalUrl,
			...(club.logo && { images: [{ url: club.logo, alt: club.name }] }),
		},
		twitter: {
			card: "summary_large_image",
			title: `${club.name} - RECONNED`,
			description,
		},
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
