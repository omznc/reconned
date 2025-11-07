import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { SportsEvent, WithContext } from "schema-dts";
import NotFoundTemporary from "@/app/[locale]/not-found";
import JsonLdScript from "@/components/json-ld-script";
import { EventOverview } from "@/components/overviews/event-overview";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateHreflangAlternatesForSluggableEntity } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Page(props: PageProps<"/[locale]/events/[id]">) {
	const user = await isAuthenticated();
	const params = await props.params;

	const conditionalPrivateWhere = user
		? {
				OR: [
					{
						isPrivate: false,
					},
					{
						club: {
							members: {
								some: {
									userId: user?.id,
								},
							},
						},
					},
				],
			}
		: {
				isPrivate: false,
			};

	const event = await prisma.event.findFirst({
		where: {
			OR: [{ id: params.id }, { slug: params.id }],
			...conditionalPrivateWhere,
		},
		include: {
			_count: {
				select: {
					eventRegistration: true,
				},
			},
			rules: true,
			club: {
				select: {
					id: true,
					name: true,
					slug: true,
					logo: true,
					verified: true,
				},
			},
		},
	});

	if (!event) {
		// TODO https://github.com/vercel/next.js/issues/63388
		// notFound();
		return <NotFoundTemporary />;
	}

	const locale = await getLocale();
	const sportsEventSchema: WithContext<SportsEvent> = {
		"@context": "https://schema.org",
		"@type": "SportsEvent",
		"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/events/${event.slug ?? event.id}`,
		name: event.name,
		description: event.description,
		sport: "Airsoft",
		startDate: event.dateStart.toISOString(),
		endDate: event.dateEnd.toISOString(),
		url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/events/${event.slug ?? event.id}`,
		image: event.image || undefined,
		location: {
			"@type": "Place",
			name: event.location,
			hasMap: event.googleMapsLink || undefined,
		},
		organizer: {
			"@type": "SportsOrganization",
			"@id": `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/clubs/${event.club.slug ?? event.club.id}`,
			name: event.club.name,
			sport: "Airsoft",
			url: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${locale}/clubs/${event.club.slug ?? event.club.id}`,
			logo: event.club.logo || undefined,
		},
		offers:
			event.costPerPerson > 0
				? {
						"@type": "Offer",
						price: event.costPerPerson,
						priceCurrency: "BAM",
						availability: "https://schema.org/InStock",
						...(event.dateRegistrationsOpen
							? { validFrom: event.dateRegistrationsOpen.toISOString() }
							: {}),
						...(event.dateRegistrationsClose
							? { validThrough: event.dateRegistrationsClose.toISOString() }
							: {}),
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
	const [params, user, t, locale] = await Promise.all([
		props.params,
		isAuthenticated(),
		getTranslations(),
		getLocale(),
	]);

	const event = await prisma.event.findFirst({
		where: {
			AND: [
				{
					OR: [{ id: params.id }, { slug: params.id }],
				},
				{
					OR: [
						{ isPrivate: false },
						{
							club: {
								members: {
									some: {
										userId: user?.id,
									},
								},
							},
						},
					],
				},
			],
		},
	});

	if (!event) {
		return notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/event`);
	ogUrl.searchParams.set("title", event.name);
	if (event.description) {
		ogUrl.searchParams.set("description", event.description);
	}
	ogUrl.searchParams.set("date", new Date(event.dateStart).toLocaleDateString("bs"));
	if (event?.image) {
		ogUrl.searchParams.set("image", event.image);
	}

	const canonicalPathname = `/${locale}/events/${event.slug || event.id}`;
	const canonicalUrl = `${env.NEXT_PUBLIC_BETTER_AUTH_URL}${canonicalPathname}`;

	return {
		title: `${event.name} - RECONNED`,
		description: event.description.slice(0, 160) ?? t("public.events.metadata.description"),
		alternates: {
			canonical: canonicalUrl,
			languages: generateHreflangAlternatesForSluggableEntity(canonicalPathname, event.id, locale),
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
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL ? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL) : undefined,
	};
}
