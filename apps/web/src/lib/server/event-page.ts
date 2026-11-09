import "server-only";

import { getExtracted } from "next-intl/server";
import apiServer from "@/lib/api/api";
import type { ApiResponse, ClubRule } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
	createAggregateRating,
	createBreadcrumbList,
	createFAQPage,
	createReviewSchema,
	createWebPageSchema,
	removeUndefined,
} from "@/lib/json-ld";
import type { SeoInput } from "@/lib/seo";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

type EventResponse = ApiResponse<"/api/events/{id}", "get">;
type ReviewsResponse = ApiResponse<"/api/reviews/{type}/{id}", "get">;

export function toEvent(eventData: EventResponse & { club: NonNullable<EventResponse["club"]> }) {
	return {
		...eventData.event,
		_count: {
			eventRegistration: eventData.registrationCount || 0,
		},
		club: {
			id: eventData.club.id,
			name: eventData.club.name,
			slug: eventData.club.slug,
			logo: eventData.club.logo,
			verified: eventData.club.verified,
			description: eventData.club.description,
		},
		rules: ((eventData as Record<string, unknown>).rules as ClubRule[]) || [],
	};
}

type EventWithClub = ReturnType<typeof toEvent>;

export async function fetchReviews(eventId: string) {
	if (!(await isFeatureEnabled("REVIEWS"))) {
		return undefined;
	}
	const response = await apiServer.GET("/api/reviews/{type}/{id}", {
		params: { path: { type: "event", id: eventId } },
	});
	return response.data;
}

function buildAggregateRating(reviewsResponse: ReviewsResponse | undefined) {
	if (!reviewsResponse || reviewsResponse.reviews.length === 0) {
		return undefined;
	}
	const reviews = reviewsResponse.reviews;
	const averageRating = reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
	return createAggregateRating({ ratingValue: averageRating, ratingCount: reviews.length });
}

function buildSportsEventSchema(
	event: EventWithClub,
	eventUrl: string,
	clubUrl: string,
	aggregateRating: ReturnType<typeof createAggregateRating> | undefined,
) {
	return removeUndefined({
		"@context": "https://schema.org",
		"@type": "SportsEvent",
		"@id": eventUrl,
		name: event.name,
		description: event.description,
		sport: "Airsoft",
		startDate: event.dateStart,
		...(event.dateEnd && { endDate: event.dateEnd }),
		url: eventUrl,
		...(event.image && { image: event.image }),
		location: removeUndefined({
			"@type": "Place",
			name: event.location,
			address: event.location,
			...(event.googleMapsLink && { hasMap: event.googleMapsLink }),
		}),
		organizer: {
			"@type": "SportsOrganization",
			"@id": clubUrl,
			name: event.club.name,
			sport: "Airsoft",
			url: clubUrl,
			...(event.club.logo && { logo: event.club.logo }),
		},
		performer: {
			"@type": "SportsOrganization",
			"@id": clubUrl,
			name: event.club.name,
			sport: "Airsoft",
		},
		...(event.costPerPerson > 0 && {
			offers: removeUndefined({
				"@type": "Offer",
				url: `${eventUrl}/apply`,
				price: event.costPerPerson,
				priceCurrency: "BAM",
				availability: "https://schema.org/InStock",
				...(event.dateRegistrationsOpen && { validFrom: event.dateRegistrationsOpen }),
				...(event.dateRegistrationsClose && { validThrough: event.dateRegistrationsClose }),
			}),
		}),
		eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
		eventStatus: "https://schema.org/EventScheduled",
		...(event._count.eventRegistration && {
			maximumAttendeeCapacity: String(event._count.eventRegistration),
		}),
		typicalAgeRange: "18+",
		about: {
			"@type": "Thing",
			name: "Airsoft",
			description: "Military simulation sport using replica firearms",
		},
		...(aggregateRating && { aggregateRating }),
	});
}

async function buildFaqSchema(event: EventWithClub, locale: string) {
	const t = await getExtracted({ locale });
	const faqs = [
		{
			question: t("What should I bring to this event?"),
			answer: t(
				"Bring your airsoft equipment, protective gear, water, and appropriate clothing. Full-face protection is mandatory.",
			),
		},
		{
			question: t("Is this event suitable for beginners?"),
			answer: t(
				"Yes, this event welcomes players of all skill levels. New players will receive a briefing and guidance.",
			),
		},
		{
			question: t("What is the cancellation policy?"),
			answer: t(
				"You can cancel up to 48 hours before the event. Contact the organizer for more information about refunds.",
			),
		},
		{
			question: t("Is food provided?"),
			answer:
				event.hasLunch || event.hasDinner || event.hasSnacks || event.hasDrinks
					? t("Yes, food and drinks are available at this event.")
					: t("No, please bring your own food and drinks."),
		},
	];
	return createFAQPage({
		faqs,
		name: event.name,
		description: event.description || undefined,
	});
}

async function buildReviewSchema(event: EventWithClub, reviewsResponse: ReviewsResponse | undefined, locale: string) {
	if (!reviewsResponse || reviewsResponse.reviews.length === 0) {
		return undefined;
	}
	const t = await getExtracted({ locale });
	return createReviewSchema({
		reviews: reviewsResponse.reviews.map((review) => ({
			author: review.author?.name || t("Anonymous"),
			rating: review.rating,
			content: review.content || "",
			datePublished: new Date(review.createdAt).toISOString(),
		})),
		itemReviewed: event.name,
		itemReviewedType: "SportsEvent",
	});
}

export async function buildSchemas(event: EventWithClub, locale: string, reviewsResponse: ReviewsResponse | undefined) {
	const t = await getExtracted({ locale });
	const eventUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}`;
	const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.club.slug || event.club.id}`;

	const sportsEventSchema = buildSportsEventSchema(event, eventUrl, clubUrl, buildAggregateRating(reviewsResponse));

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}` },
		{ name: t("Events"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events` },
		{ name: event.name, url: eventUrl },
	]);

	const [faqSchema, reviewSchema] = await Promise.all([
		(await isFeatureEnabled("FAQ_SCHEMA")) ? buildFaqSchema(event, locale) : undefined,
		buildReviewSchema(event, reviewsResponse, locale),
	]);

	const webPageSchema = createWebPageSchema({
		pageUrl: eventUrl,
		name: event.name,
		dateModified: event.updatedAt,
		datePublished: event.createdAt,
	});

	return [sportsEventSchema, webPageSchema, breadcrumbSchema, faqSchema, reviewSchema]
		.filter((schema) => schema !== undefined)
		.map((schema) => JSON.stringify(schema));
}

function buildEventKeywords(event: EventWithClub) {
	return [
		"airsoft event",
		"airsoft match",
		"airsoft tournament",
		"airsoft game",
		"airsoft event BiH",
		"airsoft event Bosnia",
		event.name,
		event.club?.name ? `airsoft ${event.club.name}` : null,
		event.location || null,
		`airsoft event ${event.location || ""}`,
	]
		.filter(Boolean)
		.join(", ");
}

export async function buildEventSeo(event: EventWithClub, locale: string, schemas: string[]): Promise<SeoInput> {
	const t = await getExtracted({ locale });
	const pathPrefix = "/events";
	const baseUrl = env.NEXT_PUBLIC_WEB_URL || "";
	const club = event.club;

	const eventDate = new Date(event.dateStart).toLocaleDateString(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	const clubName = club?.name || t("an airsoft club");

	const description =
		event.description && event.description.length > 50
			? `${event.description.slice(0, 155).trim()}...`
			: `${event.name} - ${t("airsoft event")} ${t("organized by")} ${clubName}. ${t("Date")}: ${eventDate}. ${t("Register now on RECONNED.")}`;

	const keywords = buildEventKeywords(event);

	return {
		title: `${event.name} - RECONNED`,
		description,
		keywords,
		canonical: constructCanonicalUrl(baseUrl, `${pathPrefix}/${event.slug || event.id}`, locale),
		languages: generateHreflangAlternatesForSluggableEntity(
			baseUrl,
			pathPrefix,
			event.id,
			locale,
			event.slug || undefined,
		),
		image: event.image ? { url: event.image, alt: event.name, width: 1200, height: 630 } : undefined,
		schemas,
	};
}

/** Per-viewer data for the event overview: club management rights and the registration flag. */
export async function fetchEventViewerData(clubId: string, signedIn: boolean) {
	const [membership, eventRegistrationEnabled] = await Promise.all([
		signedIn
			? apiServer.GET("/api/clubs/{id}/membership", { params: { path: { id: clubId } } })
			: Promise.resolve({ data: null }),
		isFeatureEnabled("EVENT_REGISTRATION"),
	]);
	const role = membership.data?.membership?.role;
	return { role: role ?? null, eventRegistrationEnabled };
}
