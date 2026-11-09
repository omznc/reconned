import "server-only";

import { getExtracted } from "next-intl/server";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
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
import type { SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

type Club = ApiResponse<"/api/clubs/{id}", "get">;
type Reviews = ApiResponse<"/api/reviews/{type}/{id}", "get">["reviews"];

export type ClubPageInput = { id: string; locale: string; signedIn: boolean };

type MembershipData = ApiResponse<"/api/clubs/{id}/membership", "get">;

function membershipInfo(data: MembershipData | null | undefined) {
	const role = data?.membership?.role;
	return {
		isMember: !!data?.isMember,
		isManager: role === "MANAGER" || role === "CLUB_OWNER",
		membership: data?.isMember && data?.membership ? data.membership : null,
	};
}

type MembersData = ApiResponse<"/api/clubs/{id}/members", "get">;
type InvitesData = ApiResponse<"/api/users/invites", "get">;

function memberFields(data: MembersData | null | undefined) {
	return { members: data?.members || [], privateCount: data?.privateCount || 0 };
}

function instagramFields(data: ApiResponse<"/api/clubs/{id}/instagram/media", "get"> | null | undefined, club: Club) {
	return data || { media: [], username: club.instagramUsername || null };
}

function clubInvites(data: InvitesData | null | undefined, clubId: string) {
	return (data?.invites || []).filter((invite: { clubId: string }) => invite.clubId === clubId);
}

async function fetchClubResponses(club: Club, signedIn: boolean, reviewsEnabled: boolean) {
	const path = { id: club.id };
	const empty = Promise.resolve({ data: null, error: null });

	return await Promise.all([
		signedIn ? apiServer.GET("/api/clubs/{id}/membership", { params: { path } }) : empty,
		apiServer.GET("/api/clubs/{id}/has-owner", { params: { path } }),
		apiServer.GET("/api/clubs/{id}/members", { params: { path } }),
		apiServer.GET("/api/clubs/{id}/posts", { params: { path } }),
		apiServer.GET("/api/clubs/{id}/alliances", { params: { path } }),
		club.instagramConnected
			? apiServer.GET("/api/clubs/{id}/instagram/media", { params: { path, query: { limit: 20 } } })
			: empty,
		// Per-user data: the API client forwards the caller's auth cookie.
		signedIn ? apiServer.GET("/api/users/invites") : empty,
		reviewsEnabled
			? apiServer.GET("/api/reviews/{type}/{id}", { params: { path: { type: "club", id: club.id } } })
			: empty,
		isFeatureEnabled("FAQ_SCHEMA"),
	]);
}

async function fetchClubExtras(club: Club, signedIn: boolean) {
	const reviewsEnabled = await isFeatureEnabled("REVIEWS");
	const [membership, hasOwner, members, posts, alliances, instagram, invites, reviews, faqEnabled] =
		await fetchClubResponses(club, signedIn, reviewsEnabled);

	return {
		...membershipInfo(membership.data),
		hasOwner: hasOwner.data?.hasOwner || false,
		...memberFields(members.data),
		posts: posts.data?.posts || [],
		alliances: alliances.data?.alliances || [],
		instagram: instagramFields(instagram.data, club),
		invites: clubInvites(invites.data, club.id),
		reviews: reviewsEnabled ? reviews.data?.reviews : undefined,
		faqEnabled,
	};
}

function clubContactPoint(club: Club) {
	if (!(club.contactEmail || club.contactPhone)) {
		return {};
	}
	return {
		contactPoint: removeUndefined({
			"@type": "ContactPoint",
			...(club.contactEmail && { email: club.contactEmail }),
			...(club.contactPhone && { telephone: club.contactPhone }),
			contactType: "customer service",
		}),
	};
}

function clubAggregateRating(reviews: Reviews | undefined) {
	if (!reviews || reviews.length === 0) {
		return undefined;
	}
	const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
	return createAggregateRating({ ratingValue: averageRating, ratingCount: reviews.length });
}

function buildOrganizationSchema(club: Club, clubUrl: string, reviews: Reviews | undefined) {
	const aggregateRating = clubAggregateRating(reviews);

	return removeUndefined({
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		"@id": clubUrl,
		name: club.name,
		numberOfEmployees: { "@type": "QuantitativeValue", value: club._count.members },
		...(club.description && { description: club.description }),
		sport: "Airsoft",
		url: clubUrl,
		...(club.logo && { logo: club.logo }),
		...(club.dateFounded && { foundingDate: club.dateFounded }),
		...(club.location && { address: createPostalAddress({ location: club.location, country: "BA" }) }),
		...(club.latitude &&
			club.longitude && { geo: createGeoCoordinates({ latitude: club.latitude, longitude: club.longitude }) }),
		...clubContactPoint(club),
		...(club.website && { sameAs: [club.website] }),
		...(aggregateRating && { aggregateRating }),
	});
}

async function buildFaqSchema(club: Club, locale: string) {
	const t = await getExtracted({ locale });
	return createFAQPage({
		faqs: [
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
		],
		name: club.name,
		description: club.description || undefined,
	});
}

async function buildReviewSchema(club: Club, reviews: Reviews | undefined, locale: string) {
	if (!reviews || reviews.length === 0) {
		return undefined;
	}
	const t = await getExtracted({ locale });
	return createReviewSchema({
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

async function buildSchemas(club: Club, locale: string, extras: Awaited<ReturnType<typeof fetchClubExtras>>) {
	const t = await getExtracted({ locale });
	const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${club.slug || club.id}`;
	const breadcrumb = createBreadcrumbList([
		{ name: t("Home"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}` },
		{ name: t("Clubs"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs` },
		{ name: club.name, url: clubUrl },
	]);
	const webPage = createWebPageSchema({
		pageUrl: clubUrl,
		name: club.name,
		dateModified: club.updatedAt,
		datePublished: club.createdAt,
	});

	const [faq, review] = await Promise.all([
		extras.faqEnabled ? buildFaqSchema(club, locale) : undefined,
		buildReviewSchema(club, extras.reviews, locale),
	]);

	return [buildOrganizationSchema(club, clubUrl, extras.reviews), webPage, breadcrumb, faq, review].filter(
		(schema) => schema !== undefined,
	);
}

function buildDescription(club: Club) {
	if (club.description) {
		return club.description.length > 150 ? `${club.description.slice(0, 147)}...` : club.description;
	}
	const place = club.location ? ` in ${club.location}` : "";
	const verified = club.verified ? " Verified airsoft club on RECONNED." : "";
	return `${club.name} is an airsoft club${place}.${verified}`;
}

/** Same title, description, canonical and hreflang that `generateMetadata` produced. */
function buildSeo(club: Club, locale: string, schemas: string[]): SeoInput {
	const pathPrefix = "/clubs";
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
	const keywords = [
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

	return {
		title: `${club.name} - RECONNED`,
		description: buildDescription(club),
		keywords,
		canonical: constructCanonicalUrl(baseUrl, `${pathPrefix}/${club.slug || club.id}`, locale),
		languages: generateHreflangAlternatesForSluggableEntity(
			baseUrl,
			pathPrefix,
			club.id,
			locale,
			club.slug || undefined,
		),
		image: club.logo ? { url: club.logo, alt: club.name } : undefined,
		schemas,
	};
}

export async function loadClubPage({ id, locale, signedIn }: ClubPageInput) {
	const { data: club, error, response } = await apiServer.GET("/api/clubs/{id}", { params: { path: { id } } });

	// A missing club must answer 404, not a 200 page that says "not found": a soft 404 keeps deleted
	// and mistyped club URLs in the index. A backend failure stays a rendered error, so an outage
	// never tells crawlers that real clubs are gone.
	if (response.status === 404) {
		return { kind: "not-found" as const };
	}
	if (error || !club) {
		return { kind: "error" as const };
	}

	const extras = await fetchClubExtras(club, signedIn);
	const schemas = await buildSchemas(club, locale, extras);

	return {
		kind: "ok" as const,
		club,
		extras,
		seo: buildSeo(
			club,
			locale,
			schemas.map((s) => JSON.stringify(s)),
		),
	};
}
