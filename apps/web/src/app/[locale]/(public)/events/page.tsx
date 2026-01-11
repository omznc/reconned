import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, Clock, DollarSign, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getExtracted, getLocale } from "next-intl/server";
import type { ItemList, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { getDateFnsLocale } from "@/lib/date-locale";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Page() {
	const locale = await getLocale();
	const dateFnsLocale = getDateFnsLocale(locale);
	const t = await getExtracted();

	const { data, error } = await apiServer.GET("/api/events/upcoming", {
		params: {
			query: {
				limit: 100,
			},
		},
	});

	if (error) {
		console.error("Error loading events:", error);
		return <div>{t("Error loading events")}</div>;
	}

	if (!data) {
		return <div>{t("Error loading events")}</div>;
	}

	const upcomingEvents = data.events.map((event) => ({
		...event,
		dateStart: new Date(event.dateStart),
		dateEnd: event.dateEnd ? new Date(event.dateEnd) : null,
		dateRegistrationsClose: event.dateRegistrationsClose ? new Date(event.dateRegistrationsClose) : null,
		club: event.club
			? {
					name: event.club.name,
				}
			: null,
	}));

	const itemListSchema: WithContext<ItemList> = {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: t("Airsoft events - RECONNED"),
		description: t(
			"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
		numberOfItems: upcomingEvents.length,
		itemListElement: upcomingEvents.map((event, index) => ({
			"@type": "ListItem",
			position: index + 1,
			item: {
				"@type": "SportsEvent",
				"@id": `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}`,
				name: event.name,
				description: event.description,
				sport: "Airsoft",
				startDate: event.dateStart.toISOString(),
				endDate: event.dateEnd?.toISOString() || undefined,
				url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}`,
				image: event.image || undefined,
				location: {
					"@type": "Place",
					name: event.location,
					address: event.location,
				},
				organizer: {
					"@type": "SportsOrganization",
					name: event.club?.name,
					sport: "Airsoft",
				},
				performer: event.club
					? {
							"@type": "SportsOrganization",
							name: event.club.name,
							sport: "Airsoft",
						}
					: undefined,
				offers:
					event.costPerPerson > 0
						? {
								"@type": "Offer",
								url: `${env.NEXT_PUBLIC_WEB_URL}/${locale}/events/${event.slug || event.id}/apply`,
								price: event.costPerPerson,
								priceCurrency: "BAM",
							}
						: undefined,
				eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
				eventStatus: "https://schema.org/EventScheduled",
			},
		})),
	};

	return (
		<div className="flex flex-col gap-4 max-w-[1200px] py-8 px-4">
			<JsonLdScript data={itemListSchema} />
			<h1 className="text-xl font-bold">{t("Upcoming events")}</h1>
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{upcomingEvents.length === 0 && (
					<div className="text-muted-foreground">{t("There are no upcoming events")}</div>
				)}
				{upcomingEvents.map((event) => (
					<Card key={event.id} className="flex flex-col">
						<CardHeader className="p-0">
							{event.image && (
								<Image
									src={event.image}
									alt={event.name}
									width={400}
									height={200}
									className="w-full mb-4 h-48 object-cover"
								/>
							)}
							<CardTitle className="mt-4 px-6">{event.name}</CardTitle>
							<CardDescription className="px-6 pb-6">{event.description}</CardDescription>
						</CardHeader>
						<CardContent className="grow flex-col flex gap-1">
							<div className="flex items-center">
								<CalendarDays className="w-5 h-5 mr-2 text-muted-foreground" />
								<span>
									{format(event.dateStart, "MMM d, yyyy")}
									{event.dateEnd && ` - ${format(event.dateEnd, "MMM d, yyyy")}`}
								</span>
							</div>
							<div className="flex items-center">
								<Clock className="w-5 h-5 mr-2 text-muted-foreground" />
								<span>{format(event.dateStart, "h:mm a")}</span>
							</div>
							<div className="flex items-center">
								<MapPin className="w-5 h-5 mr-2 text-muted-foreground" />
								<span>{event.location}</span>
							</div>
							<div className="flex items-center">
								<DollarSign className="w-5 h-5 mr-2 text-muted-foreground" />
								<span>
									{event.costPerPerson.toFixed(2)}KM {t("per person")}
								</span>
							</div>
							<div className="flex flex-wrap gap-2 my-4">
								<Badge className="grow justify-center">
									{event.allowFreelancers ? t("Freelancer-friendly") : t("No freelancers")}
								</Badge>
								{event.hasBreakfast && <Badge className="grow justify-center">{t("Breakfast")}</Badge>}
								{event.hasLunch && <Badge className="flex-growjustify-center ">{t("Lunch")}</Badge>}
								{event.hasDinner && <Badge className="grow justify-center ">{t("Dinner")}</Badge>}
								{event.hasSnacks && <Badge className="grow justify-center">{t("Snacks")}</Badge>}
								{event.hasDrinks && <Badge className="grow justify-center">{t("Drinks")}</Badge>}
								{event.hasPrizes && <Badge className="grow justify-center ">{t("Prizes")}</Badge>}
							</div>
						</CardContent>
						<CardFooter className="flex gap-2 -mt-4 flex-col items-start justify-between">
							<div className="text-sm text-muted-foreground">
								{t("Starts")}{" "}
								{formatDistanceToNow(event.dateStart, {
									addSuffix: true,
									locale: dateFnsLocale,
								})}
							</div>
							{event.dateRegistrationsClose && (
								<div className="text-sm text-muted-foreground">
									{t("Registrations open for ")}{" "}
									{formatDistanceToNow(event.dateRegistrationsClose, {
										locale: dateFnsLocale,
									})}
								</div>
							)}
							<Button asChild={true} className="w-full">
								<Link href={`/events/${event.id}`}>{t("View")}</Link>
							</Button>
						</CardFooter>
					</Card>
				))}
			</div>
		</div>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("Airsoft events - RECONNED"),
		description: t(
			"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
		),
		keywords: t(
			"airsoft events, airsoft matches, airsoft tournaments, airsoft games, airsoft competitions, find airsoft event, join airsoft event, airsoft event BiH, airsoft event Bosnia, airsoft event registration",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("Airsoft events - RECONNED"),
			description: t(
				"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/events", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("Airsoft events - RECONNED"),
			description: t(
				"The list of all airsoft events on the platform. The first universal platform for airsoft clubs, events, and players.",
			),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/events", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/events", locale),
		},
	};
}
