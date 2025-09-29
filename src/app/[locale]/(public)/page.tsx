import {
	addMonths,
	endOfMonth,
	format,
	formatDistanceToNow,
	parse as parseDateFns,
	startOfMonth,
	subMonths,
} from "date-fns";
import { bs } from "date-fns/locale";
import {
	Building2,
	Calendar,
	CalendarDays,
	Clock,
	DollarSign,
	LayoutDashboard,
	MapIcon,
	MapPin,
	Medal,
	Search,
	ShieldQuestion,
	Users,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { SportsOrganization, WithContext } from "schema-dts";
import { MessageHandler } from "@/app/[locale]/(public)/_components/message-handler";
import { EventCalendar } from "@/components/event-calendar";
import JsonLdScript from "@/components/json-ld-script";
import { HomeDrawing } from "@/components/logos/drawings/home-drawing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

interface PageProps {
	searchParams: Promise<{
		month?: string;
	}>;
}

export const revalidate = 3600; // 1 hour

export default async function Home({ searchParams }: PageProps) {
	const user = await isAuthenticated();
	const { month } = await searchParams;

	const currentDate = month ? parseDateFns(month, "yyyy-MM", new Date()) : new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

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

	const events = await prisma.event.findMany({
		where: {
			dateStart: {
				gte: startDate,
				lte: endDate,
			},
			...conditionalPrivateWhere,
		},
		include: {
			club: {
				select: {
					name: true,
					verified: true,
				},
			},
		},
	});

	const upcomingEvents = await prisma.event.findMany({
		where: {
			dateStart: {
				gte: new Date(),
			},
			...conditionalPrivateWhere,
		},
		orderBy: {
			dateStart: "asc",
		},
		include: {
			club: {
				select: {
					name: true,
					verified: true,
				},
			},
		},
		take: 3,
	});

	const t = await getTranslations();

	const websiteSchema = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Reconned",
		description: t("public.home.metadata.description"),
		url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
		logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
		sameAs: ["https://github.com/omznc/reconned"],
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/search?q={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
		about: {
			"@type": "SportsOrganization",
			name: "Airsoft Community",
			sport: "Airsoft",
			description: "Platform connecting airsoft clubs and players",
		},
	};

	const organizationSchema: WithContext<SportsOrganization> = {
		"@context": "https://schema.org",
		"@type": "SportsOrganization",
		name: "Reconned",
		sport: "Airsoft",
		description: t("public.home.metadata.description"),
		url: env.NEXT_PUBLIC_BETTER_AUTH_URL,
		logo: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/reconned-logo-light.svg`,
		foundingDate: "2024",
		address: {
			"@type": "PostalAddress",
			addressCountry: "BA",
		},
		sameAs: ["https://github.com/omznc/reconned"],
	};

	return (
		<>
			<JsonLdScript data={websiteSchema} />
			<JsonLdScript data={organizationSchema} />
			<MessageHandler />
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<HomeDrawing className="absolute opacity-0 lg:opacity-100 transition-all -right-110 bottom-0 w-full max-w-[400px] h-auto dark:invert" />
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
							{t.rich("public.home.hero.title", {
								br: () => <br />,
							})}
						</h1>
						<Link href="/changelog">
							<span
								className={
									"inline-flex items-center rounded-full border border-green-500/30 dark:text-white bg-green-500/50 px-2.5 py-0.5 text-xs font text-black transition-colors hover:bg-green-500/20"
								}
							>
								{t("public.home.hero.button")}
							</span>
						</Link>
						<p className="text-xl text-text/80 mb-8 mt-4">{t("public.home.hero.description")}</p>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
							<Button
								size="sm"
								variant="default"
								className="aspect-square flex-col h-auto p-2 border hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/search">
									<Search className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.search")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="aspect-square flex-col h-auto p-2 hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/events">
									<Calendar className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.events")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="aspect-square flex-col h-auto p-2 hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/clubs">
									<Building2 className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.clubs")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="aspect-square flex-col h-auto p-2 hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/users">
									<Users className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.members")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="default"
								className="aspect-square flex-col h-auto p-2 border border-transparent hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/map">
									<MapIcon className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.map")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="aspect-square flex-col h-auto p-2 hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/about">
									<ShieldQuestion className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.about")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="aspect-square flex-col h-auto p-2 hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/dashboard">
									<LayoutDashboard className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.dashboard")}</span>
								</Link>
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="aspect-square flex-col h-auto p-2 hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/sponsors">
									<Medal className="scale-150 mb-2" />
									<span className="text-sm">{t("public.home.hero.sponsors")}</span>
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-8">
				<div className="flex flex-col gap-4">
					<div>
						<h2 className="text-2xl font-bold">{t("public.home.upcomingEventsTitle")}</h2>
						<p className="text-gray-400">{t("public.home.upcomingEventsSubtitle")}</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{upcomingEvents.length === 0 && (
							<div className="text-muted-foreground">{t("public.home.upcomingEventsNone")}</div>
						)}

						{upcomingEvents.map((event) => (
							<Link key={event.id} href={`/events/${event.id}`}>
								<Card className="flex flex-col bg-sidebar hover:border-red-500 transition-all">
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
										<CardTitle className="mt-4 px-6">
											{event.name} ({event.club?.name})
										</CardTitle>
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
										{event.dateStart && (
											<div className="flex items-center">
												<Clock className="w-5 h-5 mr-2 text-muted-foreground" />
												<span>{format(event.dateStart, "h:mm a")}</span>
											</div>
										)}
										{event.location && (
											<div className="flex items-center">
												<MapPin className="w-5 h-5 mr-2 text-muted-foreground" />
												<span>{event.location}</span>
											</div>
										)}
										{event.costPerPerson !== undefined && (
											<div className="flex items-center">
												<DollarSign className="w-5 h-5 mr-2 text-muted-foreground" />
												<span>
													{event.costPerPerson.toFixed(2)}
													KM po osobi
												</span>
											</div>
										)}
										<div className="flex flex-wrap gap-2 my-4">
											<Badge variant="outline" className="grow justify-center">
												{event.allowFreelancers
													? t("public.home.eventCard.canFreelance")
													: t("public.home.eventCard.cannotFreelance")}
											</Badge>
											{event.hasBreakfast && (
												<Badge variant="outline" className="grow justify-center">
													{t("public.home.eventCard.breakfast")}
												</Badge>
											)}
											{event.hasLunch && (
												<Badge variant="outline" className="grow justify-center">
													{t("public.home.eventCard.lunch")}
												</Badge>
											)}
											{event.hasDinner && (
												<Badge variant="outline" className="grow justify-center">
													{t("public.home.eventCard.dinner")}
												</Badge>
											)}
											{event.hasSnacks && (
												<Badge variant="outline" className="grow justify-center">
													{t("public.home.eventCard.snacks")}
												</Badge>
											)}
											{event.hasDrinks && (
												<Badge variant="outline" className="grow justify-center">
													{t("public.home.eventCard.drinks")}
												</Badge>
											)}
											{event.hasPrizes && (
												<Badge variant="outline" className="grow justify-center">
													{t("public.home.eventCard.prizes")}
												</Badge>
											)}
										</div>
										{event.isPrivate && (
											<span className="text-xs text-muted-foreground">
												{t("public.home.eventCard.privateEvent", {
													club: event.club?.name,
												})}
											</span>
										)}
									</CardContent>
									<CardFooter className="flex justify-between items-center">
										<div className="flex flex-col">
											<div className="text-sm text-muted-foreground">
												{t("public.home.eventCard.starts")}{" "}
												{formatDistanceToNow(event.dateStart, {
													addSuffix: true,
													locale: bs,
												})}
											</div>
											{event.dateRegistrationsClose && (
												<div className="text-sm mr-1 text-muted-foreground">
													Prijave još{" "}
													{formatDistanceToNow(event.dateRegistrationsClose, {
														locale: bs,
													})}
												</div>
											)}
										</div>
									</CardFooter>
								</Card>
							</Link>
						))}
					</div>
				</div>
				<EventCalendar events={events} />
			</div>
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations();

	return {
		title: t("public.home.metadata.title"),
		description: t("public.home.metadata.description"),
	};
}
