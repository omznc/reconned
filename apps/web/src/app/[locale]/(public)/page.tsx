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
import { getExtracted, getLocale } from "next-intl/server";
import { MessageHandler } from "@/app/[locale]/(public)/_components/message-handler";
import { EventCalendar } from "@/components/event-calendar";
import { HomeDrawing } from "@/components/logos/drawings/home-drawing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { constructCanonicalUrl, generatePageLanguages } from "@/lib/utils";

export const revalidate = 3600; // 1 hour

export default async function Home(props: PageProps<"/[locale]">) {
	const [searchParams, user] = await Promise.all([props.searchParams, isAuthenticated()]);
	const { month } = searchParams;

	const currentDate = month ? parseDateFns(month as string, "yyyy-MM", new Date()) : new Date();
	const startDate = startOfMonth(subMonths(currentDate, 1));
	const endDate = endOfMonth(addMonths(currentDate, 1));

	const [dashboardClubsResult, calendarEventsResult, upcomingEventsResult] = await Promise.all([
		user
			? apiServer.GET("/api/dashboard/clubs")
			: Promise.resolve({
					data: null,
					error: null,
				}),
		apiServer.GET("/api/events/calendar", {
			params: {
				query: {
					startDate: startDate.toISOString(),
					endDate: endDate.toISOString(),
				},
			},
		}),
		apiServer.GET("/api/events/upcoming", {
			params: {
				query: {
					limit: 3,
				},
			},
		}),
	]);

	const events =
		calendarEventsResult.error || !calendarEventsResult.data
			? []
			: calendarEventsResult.data.events.map((event) => ({
					...event,
					club: event.club || null,
				}));

	const upcomingEvents =
		upcomingEventsResult.error || !upcomingEventsResult.data
			? []
			: upcomingEventsResult.data.events.map((event) => ({
					...event,
					club: event.club || null,
				}));

	const t = await getExtracted();

	const managedClubs =
		dashboardClubsResult.error || !dashboardClubsResult.data
			? []
			: dashboardClubsResult.data.clubs.filter(
					(club) => club.membershipRole === "MANAGER" || club.membershipRole === "CLUB_OWNER",
				);

	return (
		<>
			<MessageHandler />
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<HomeDrawing className="absolute opacity-0 lg:opacity-100 transition-all -right-110 bottom-0 w-full max-w-[400px] h-auto dark:invert" />
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
							{t.rich("Just Airsoft,<br></br> but better.", {
								br: () => <br />,
							})}
						</h1>
						<Link href="/changelog">
							<span
								className={
									"inline-flex items-center rounded-full border border-green-500/30 dark:text-white bg-green-500/50 px-2.5 py-0.5 text-xs font text-black transition-colors hover:bg-green-500/20"
								}
							>
								{t("View the changelog")}
							</span>
						</Link>
						<p className="text-xl text-text/80 mb-8 mt-4">
							{t(
								"Join the most advanced airsoft community. Find matches, connect with players and improve your game.",
							)}
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
							<Button
								size="sm"
								variant="default"
								className="aspect-square flex-col h-auto p-2 border hover:border-red-500 transition-all"
								asChild
							>
								<Link href="/search">
									<Search className="scale-150 mb-2" />
									<span className="text-sm">{t("Search all")}</span>
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
									<span className="text-sm">{t("Events")}</span>
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
									<span className="text-sm">{t("Clubs")}</span>
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
									<span className="text-sm">{t("Players")}</span>
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
									<span className="text-sm">{t("Show map")}</span>
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
									<span className="text-sm">{t("Find out more")}</span>
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
									<span className="text-sm">{t("Dashboard")}</span>
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
									<span className="text-sm">{t("Sponsors")}</span>
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-8">
				<div className="flex flex-col gap-4">
					<div>
						<h2 className="text-2xl font-bold">{t("Upcoming events")}</h2>
						<p className="text-gray-400">{t("See you on the field")}</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{upcomingEvents.length === 0 && (
							<div className="text-muted-foreground">{t("There are no upcoming matches")}</div>
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
													? t("Freelancers allowed")
													: t("For members only")}
											</Badge>
											{event.hasBreakfast && (
												<Badge variant="outline" className="grow justify-center">
													{t("Breakfast")}
												</Badge>
											)}
											{event.hasLunch && (
												<Badge variant="outline" className="grow justify-center">
													{t("Lunch")}
												</Badge>
											)}
											{event.hasDinner && (
												<Badge variant="outline" className="grow justify-center">
													{t("Dinner")}
												</Badge>
											)}
											{event.hasSnacks && (
												<Badge variant="outline" className="grow justify-center">
													{t("Snacks")}
												</Badge>
											)}
											{event.hasDrinks && (
												<Badge variant="outline" className="grow justify-center">
													{t("Drinks")}
												</Badge>
											)}
											{event.hasPrizes && (
												<Badge variant="outline" className="grow justify-center">
													{t("Awards")}
												</Badge>
											)}
										</div>
										{event.isPrivate && (
											<span className="text-xs text-muted-foreground">
												{t("This is a private event, but you are in the {clubName} club.", {
													clubName: event.club?.name || "",
												})}
											</span>
										)}
									</CardContent>
									<CardFooter className="flex justify-between items-center">
										<div className="flex flex-col">
											<div className="text-sm text-muted-foreground">
												{t("Starts")}{" "}
												{formatDistanceToNow(event.dateStart, {
													addSuffix: true,
													locale: bs,
												})}
											</div>
											{event.dateRegistrationsClose && (
												<div className="text-sm mr-1 text-muted-foreground">
													{t("Registrations open for")}{" "}
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
				<EventCalendar
					events={events}
					managedClubs={
						managedClubs.length > 0
							? managedClubs.map((club) => ({
									id: club.id,
									name: club.name,
									verified: (club as { verified?: boolean }).verified || false,
									logo: (club as { logo?: string | null }).logo || null,
									slug: (club as { slug?: string | null }).slug || null,
								}))
							: undefined
					}
				/>
			</div>
		</>
	);
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getExtracted();
	const locale = await getLocale();

	return {
		title: t("RECONNED - Airsoft clubs, events, and players"),
		description: t("The first universal platform for airsoft clubs, events, and players."),
		keywords: t(
			"airsoft platform, airsoft community, airsoft events, airsoft clubs, airsoft players, airsoft BiH, airsoft Bosnia, find airsoft events, join airsoft clubs, airsoft community platform",
		)
			.split(",")
			.map((keyword: string) => keyword.trim()),
		openGraph: {
			title: t("RECONNED - Airsoft clubs, events, and players"),
			description: t("The first universal platform for airsoft clubs, events, and players."),
			type: "website",
			url: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/", locale),
		},
		twitter: {
			card: "summary_large_image",
			title: t("RECONNED - Airsoft clubs, events, and players"),
			description: t("The first universal platform for airsoft clubs, events, and players."),
		},
		alternates: {
			canonical: constructCanonicalUrl(env.NEXT_PUBLIC_WEB_URL || "", "/", locale),
			languages: generatePageLanguages(env.NEXT_PUBLIC_WEB_URL || "", "/", locale),
		},
	};
}
