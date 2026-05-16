import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { EventOverview } from "@/components/overviews/event-overview";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { env } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
	createAggregateRating,
	createBreadcrumbList,
	createFAQPage,
	createReviewSchema,
	removeUndefined,
} from "@/lib/json-ld";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const revalidate = 3600;

export default async function Page(props: PageProps<"/[locale]/events/[id]">) {
	const params = await props.params;
	const t = await getExtracted();

	const { data: eventData, error: eventError } = await apiServer.GET("/api/events/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (eventError || !eventData) {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}

	const { data: rulesData } = await apiServer.GET("/api/events/{id}/rules", {
		params: {
			path: {
				id: eventData.event.id,
			},
		},
	});

	const { data: registrationsCountData } = await apiServer.GET("/api/events/{id}/registrations/count", {
		params: {
			path: {
				id: eventData.event.id,
			},
		},
	});

	if (!eventData.club) {
		return <ErrorPage title={t("Event Not Found - RECONNED")} />;
	}

	const base = eventData.event;

	const event = {
		...base,
		_count: {
			eventRegistration: registrationsCountData?.count || 0,
		},
		club: {
			id: eventData.club.id,
			name: eventData.club.name,
			slug: eventData.club.slug,
			logo: eventData.club.logo,
			verified: eventData.club.verified,
			description: eventData.club.description,
		},
		rules: rulesData?.rules || [],
	};

	const locale = await getLocale();
	const eventUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}`;
	const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.club.slug || event.club.id}`;

	let aggregateRating: ReturnType<typeof createAggregateRating> | undefined;
	type ReviewsDataType = ApiResponse<"/api/reviews/{type}/{id}", "get">;
	let reviewsResponse: ReviewsDataType | undefined;
	const reviewsEnabled = await isFeatureEnabled("REVIEWS");
	if (reviewsEnabled) {
		const response = await apiServer.GET("/api/reviews/{type}/{id}", {
			params: {
				path: {
					type: "event",
					id: event.id,
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

	const sportsEventSchema = removeUndefined({
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

	const breadcrumbSchema = createBreadcrumbList([
		{ name: t("Home"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}` },
		{ name: t("Events"), url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events` },
		{ name: event.name, url: eventUrl },
	]);

	const isFaqSchemaEnabled = await isFeatureEnabled("FAQ_SCHEMA");

	// Generate FAQ schema for event
	let faqSchema: ReturnType<typeof createFAQPage> | undefined;
	if (isFaqSchemaEnabled) {
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
		faqSchema = createFAQPage({
			faqs,
			name: event.name,
			description: event.description || undefined,
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
				itemReviewed: event.name,
				itemReviewedType: "SportsEvent",
			});
		}
	}

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8  px-4">
			<JsonLdScript data={sportsEventSchema} />
			<JsonLdScript data={breadcrumbSchema} />
			{faqSchema && <JsonLdScript data={faqSchema} />}
			{reviewSchema && <JsonLdScript data={reviewSchema} />}
			<EventOverview event={event} clubId={eventData.club.id} />
		</div>
	);
}

export async function generateMetadata(props: PageProps<"/[locale]/events/[id]">): Promise<Metadata> {
	const [params, locale] = await Promise.all([props.params, getLocale()]);
	const t = await getExtracted();

	const { data, error } = await apiServer.GET("/api/events/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (error || !data) {
		return {
			title: t("Event Not Found - RECONNED"),
		};
	}
	const event = data.event;
	const club = data.club;

	const pathPrefix = "/events";
	const slugOrId = event.slug || event.id;
	const canonicalUrl = constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", `${pathPrefix}/${slugOrId}`, locale);

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

	const eventKeywords = [
		"airsoft event",
		"airsoft match",
		"airsoft tournament",
		"airsoft game",
		"airsoft event BiH",
		"airsoft event Bosnia",
		event.name,
		club?.name ? `airsoft ${club.name}` : null,
		event.location || null,
		`airsoft event ${event.location || ""}`,
	]
		.filter(Boolean)
		.join(", ");

	return {
		title: `${event.name} - RECONNED`,
		description,
		keywords: eventKeywords,
		openGraph: {
			title: `${event.name} - RECONNED`,
			description,
			type: "website",
			url: canonicalUrl,
			...(event.image && {
				images: [
					{
						url: event.image,
						width: 1200,
						height: 630,
						alt: event.name,
					},
				],
			}),
		},
		twitter: {
			card: "summary_large_image",
			title: `${event.name} - RECONNED`,
			description,
		},
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(
				env.NEXT_PUBLIC_WEB_URL || "",
				pathPrefix,
				event.id,
				locale,
				event.slug || undefined,
			),
		},
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
	};
}
