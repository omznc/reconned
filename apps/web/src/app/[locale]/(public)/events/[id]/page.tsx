import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import JsonLdScript from "@/components/json-ld-script";
import { EventOverview } from "@/components/overviews/event-overview";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { createAggregateRating, createBreadcrumbList, removeUndefined } from "@/lib/json-ld";
import { FEATURE_FLAGS } from "@/lib/server-utils";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
		},
		rules: rulesData?.rules || [],
	};

	const locale = await getLocale();
	const eventUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}`;
	const clubUrl = `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.club.slug || event.club.id}`;

	let aggregateRating: ReturnType<typeof createAggregateRating> | undefined;
	if (FEATURE_FLAGS.REVIEWS) {
		const reviewsResponse = await apiServer.GET("/api/reviews/{type}/{id}", {
			params: {
				path: {
					type: "event",
					id: event.id,
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
		...(registrationsCountData?.count && {
			maximumAttendeeCapacity: String(registrationsCountData.count),
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

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8  px-4">
			<JsonLdScript data={sportsEventSchema} />
			<JsonLdScript data={breadcrumbSchema} />
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

	const pathPrefix = "/events";
	const slugOrId = event.slug || event.id;
	const canonicalUrl = constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", `${pathPrefix}/${slugOrId}`, locale);

	return {
		title: `${event.name} - RECONNED`,
		description:
			event.description.slice(0, 160) ||
			t(
				"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
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
		openGraph: event.image
			? {
					images: [
						{
							url: event.image,
							width: 1200,
							height: 630,
							alt: event.name,
						},
					],
				}
			: undefined,
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
	};
}
