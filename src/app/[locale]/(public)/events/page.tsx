import { format, formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import { CalendarDays, Clock, DollarSign, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { ItemList, WithContext } from "schema-dts";
import JsonLdScript from "@/components/json-ld-script";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export default async function Page() {
    const [user, t, locale] = await Promise.all([isAuthenticated(), getTranslations(), getLocale()]);
    const upcomingEvents = await prisma.event.findMany({
        where: {
            dateStart: {
                gte: new Date(),
            },
            ...(user
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
                    }),
        },
        orderBy: {
            dateStart: "asc",
        },
        include: {
            club: {
                select: {
                    name: true,
                },
            },
        },
        // TODO: Add proper pagination
        take: 100,
    });

    const itemListSchema: WithContext<ItemList> = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: t("public.events.metadata.title"),
        description: t("public.events.metadata.description"),
        numberOfItems: upcomingEvents.length,
        itemListElement: upcomingEvents.map((event, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
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
                },
                organizer: {
                    "@type": "SportsOrganization",
                    name: event.club?.name,
                    sport: "Airsoft",
                },
                offers:
                    event.costPerPerson > 0
                        ? {
                                "@type": "Offer",
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
            <h1 className="text-xl font-bold">{t("public.events.title")}</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingEvents.length === 0 && <div className="text-muted-foreground">{t("public.events.none")}</div>}
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
                                    {event.costPerPerson.toFixed(2)}KM {t("public.events.costPerPerson")}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2 my-4">
                                <Badge className="grow justify-center">
                                    {event.allowFreelancers
                                        ? t("public.events.allowFreelancers")
                                        : t("public.events.onlyClubs")}
                                </Badge>
                                {event.hasBreakfast && (
                                    <Badge className="grow justify-center">{t("common.words.breakfast")}</Badge>
                                )}
                                {event.hasLunch && (
                                    <Badge className="flex-growjustify-center ">{t("common.words.lunch")}</Badge>
                                )}
                                {event.hasDinner && (
                                    <Badge className="grow justify-center ">{t("common.words.dinner")}</Badge>
                                )}
                                {event.hasSnacks && (
                                    <Badge className="grow justify-center">{t("common.words.snacks")}</Badge>
                                )}
                                {event.hasDrinks && (
                                    <Badge className="grow justify-center">{t("common.words.drinks")}</Badge>
                                )}
                                {event.hasPrizes && (
                                    <Badge className="grow justify-center ">{t("common.words.prizes")}</Badge>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <div className="text-sm text-muted-foreground">
                                    {t("public.events.starts")}{" "}
                                    {formatDistanceToNow(event.dateStart, {
                                        addSuffix: true,
                                        locale: bs,
                                    })}
                                </div>
                                {event.dateRegistrationsClose && (
                                    <div className="text-sm text-muted-foreground">
                                        {t("public.events.registrationsOpen")}{" "}
                                        {formatDistanceToNow(event.dateRegistrationsClose, {
                                            locale: bs,
                                        })}
                                    </div>
                                )}
                            </div>
                            <Button asChild={true}>
                                <Link href={`/events/${event.id}`}>{t("public.events.view")}</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}

export async function generateMetadata(): Promise<Metadata> {
    const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

    return {
        title: t("public.events.metadata.title"),
        description: t("public.events.metadata.description"),
        keywords: t("public.events.metadata.keywords")
            .split(",")
            .map((keyword: string) => keyword.trim()),
        alternates: {
            canonical: generateCanonicalUrl(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/events", locale),
            languages: generatePageLanguages(env.NEXT_PUBLIC_BETTER_AUTH_URL || "", "/events", locale),
        },
    };
}
