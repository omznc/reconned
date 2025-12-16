import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getExtracted, getLocale } from "next-intl/server";
import type { SportsEvent, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { EventOverview } from "@/components/overviews/event-overview";
import apiServer from "@/lib/api/api";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Page(props: PageProps<"/[locale]/events/[id]">) {
	const params = await props.params;

	const { data: eventData, error: eventError } = await apiServer.GET("/api/events/{id}", {
		params: {
			path: {
				id: params.id,
			},
		},
	});

	if (eventError || !eventData) {
		notFound();
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
		notFound();
	}

	const base = eventData.event;

	const event = {
		...base,
		_count: {
			eventRegistration: registrationsCountData?.count ?? 0,
		},
		club: {
			id: eventData.club.id,
			name: eventData.club.name,
			slug: eventData.club.slug,
			logo: eventData.club.logo,
			verified: eventData.club.verified,
		},
		rules: rulesData?.rules ?? [],
	};

	const locale = await getLocale();
	const sportsEventSchema: WithContext<SportsEvent> = {
		"@context": "https://schema.org",
		"@type": "SportsEvent",
		"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug ?? event.id}`,
		name: event.name,
		description: event.description,
		sport: "Airsoft",
		startDate: event.dateStart,
		endDate: event.dateEnd,
		url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug ?? event.id}`,
		image: event.image || undefined,
		location: {
			"@type": "Place",
			name: event.location,
			address: event.location,
			hasMap: event.googleMapsLink || undefined,
		},
		organizer: {
			"@type": "SportsOrganization",
			"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.club.slug ?? event.club.id}`,
			name: event.club.name,
			sport: "Airsoft",
			url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.club.slug ?? event.club.id}`,
			logo: event.club.logo || undefined,
		},
		performer: {
			"@type": "SportsOrganization",
			"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/clubs/${event.club.slug ?? event.club.id}`,
			name: event.club.name,
			sport: "Airsoft",
		},
		offers:
			event.costPerPerson > 0
				? {
						"@type": "Offer",
						url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug ?? event.id}/apply`,
						price: event.costPerPerson,
						priceCurrency: "BAM",
						availability: "https://schema.org/InStock",
						...(event.dateRegistrationsOpen ? { validFrom: event.dateRegistrationsOpen } : {}),
						...(event.dateRegistrationsClose ? { validThrough: event.dateRegistrationsClose } : {}),
					}
				: undefined,
		eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
		eventStatus: "https://schema.org/EventScheduled",
		// TODO: Add maximumAttendeeCapacity
		// maximumAttendeeCapacity: event.allowFreelancers ? undefined : "Members only",
		typicalAgeRange: "18+",
		about: {
			"@type": "Thing",
			name: "Airsoft",
			description: "Military simulation sport using replica firearms",
		},
	};

	return (
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8  px-4">
			<JsonLdScript data={sportsEventSchema} />
			<EventOverview event={event} />
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
		return notFound();
	}
	const event = data.event;

	const ogUrl = new URL(`${env.NEXT_PUBLIC_WEB_URL}/api/og/event`);
	ogUrl.searchParams.set("title", event.name);
	if (event.description) {
		ogUrl.searchParams.set("description", event.description);
	}
	ogUrl.searchParams.set("date", new Date(event.dateStart).toLocaleDateString("bs"));
	if (event?.image) {
		ogUrl.searchParams.set("image", event.image);
	}

	const pathPrefix = "/events";
	const slugOrId = event.slug || event.id;
	const canonicalUrl = constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", `${pathPrefix}/${slugOrId}`, locale);

	return {
		title: `${event.name} - RECONNED`,
		description:
			event.description.slice(0, 160) ??
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
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: event.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_WEB_URL ? new URL(env.NEXT_PUBLIC_WEB_URL) : undefined,
	};
}
