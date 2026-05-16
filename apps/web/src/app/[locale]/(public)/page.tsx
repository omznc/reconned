import { addMonths, endOfMonth, parse as parseDateFns, startOfMonth, subMonths } from "date-fns";
import {
	Ban,
	Building2,
	Calendar,
	ClipboardList,
	Code2,
	DollarSign,
	FileCheck,
	Globe,
	LayoutDashboard,
	Link2,
	Lock,
	Mail,
	MapIcon,
	MapPin,
	Medal,
	Pencil,
	Search,
	Settings,
	Shield,
	ShieldCheck,
	ShieldQuestion,
	Star,
	TrendingUp,
	Trophy,
	User,
	UserCheck,
	Users,
	Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { HomeCommunityStats } from "@/app/[locale]/(public)/_components/home-community-stats";
import { MessageHandler } from "@/app/[locale]/(public)/_components/message-handler";

import { EventCalendar } from "@/components/event-calendar";
import { EventCard } from "@/components/event-card";
import { InstagramIcon } from "@/components/icons";
import { HomeDrawing } from "@/components/logos/drawings/home-drawing";
import { Logo } from "@/components/logos/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

	const [dashboardClubsResult, calendarEventsResult, upcomingEventsResult, publicStatsResult] = await Promise.all([
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
		apiServer.GET("/api/public/stats"),
	]);

	const publicStats = publicStatsResult.data?.stats ?? {
		clubs: 0,
		events: 0,
		players: 0,
	};

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
						<div className="flex flex-wrap items-center gap-2">
							<Link href="/changelog">
								<span className="m-0 inline-flex max-w-full list-none overflow-hidden rounded-full border border-border/60 bg-green-500/50 py-1.5 px-2 text-xs font-semibold text-foreground">
									{t("View the changelog")}
								</span>
							</Link>
							<HomeCommunityStats stats={publicStats} />
						</div>
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
								<Link href="#about-us">
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
							<EventCard key={event.id} event={event} />
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

				<section id="about-us" className="w-full py-12 scroll-mt-20">
					<div className="flex flex-col gap-8">
						<div className="flex flex-col gap-4">
							<h2 className="text-2xl font-bold">{t("Who are we?")}</h2>
							<p className="text-lg">
								{t.rich(
									"This project was started by 2 developers from Bosnia and Herzegovina (<omar></omar> and <safet></safet>) because we wanted something better than Facebook, Viber, and others. Airsoft communities are quite new and unorganized, and we want to change that - totally transparent, totally public.",
									{
										omar: () => (
											<Link
												className="text-red-500 hover:text-red-400 transition-colors"
												href="https://omarzunic.com?utm_source=reconned&utm_medium=homepage"
											>
												Omar Zunić
											</Link>
										),
										safet: () => (
											<Link
												className="text-red-500 hover:text-red-400 transition-colors"
												href="https://safetpojskic.com?utm_source=reconned&utm_medium=homepage"
											>
												Safet Pojskić
											</Link>
										),
									},
								)}
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<h2 className="text-2xl font-bold">{t("About the platform")}</h2>
							<p className="text-lg">
								{t.rich(
									"The ultimate goal of the <logo></logo> platform is the unification of the airsoft community, initially in Bosnia and Herzegovina, and beyond. Our platform allows clubs to present themselves, organize events, and find new members. It enables players to find clubs, events, and other players, all in one place.",
									{
										logo: () => <Logo className="h-4 w-auto mb-0.5" />,
									},
								)}
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<h2 className="text-2xl font-bold">{t("Sustainability")}</h2>
							<p className="text-lg">
								{t(
									"The goal is not, and never will be pure profit. Every part of the platform is open-source, and thus available to everyone. Currently, we are completely self-funding the platform's development, but we will give clubs and individuals a chance to help with development and maintenance, with some benefits.",
								)}{" "}
								<span className="font-bold">
									{t("Core functionalities will always be free to use.")}
								</span>
							</p>
						</div>
						<div className="flex flex-col gap-4">
							<h2 className="text-2xl font-bold">{t("How to help?")}</h2>
							<p className="text-lg">
								{t(
									"If you are interested in helping with the development of the platform, please feel free to contact us. Help in the form of marketing, programming, and general sponsorship is always welcome.",
								)}{" "}
								<Link className="text-red-600" href="/sponsors">
									{t("See the list of sponsors.")}
								</Link>
							</p>
						</div>
					</div>
				</section>

				<div className="space-y-12">
					{/* Header */}
					<div className="space-y-4">
						<h2 className="text-4xl font-bold tracking-tight">{t("Built for serious airsofters")}</h2>
						<p className="text-lg text-muted-foreground max-w-2xl">
							{t("Everything you need to manage clubs, organize events, and grow the community")}
						</p>
					</div>

					{/* For Clubs */}
					<div className="space-y-6">
						<h3 className="text-2xl">{t("For Clubs")}</h3>
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<InstagramIcon className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Instagram Auto-Sync")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Automatically sync posts from your club's Instagram account")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<DollarSign className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Financial Management")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Track expenses, receipts, and budgets with full transparency")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<FileCheck className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Comprehensive Audit Logs")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Every action tracked and logged for complete accountability")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<ShieldCheck className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Permission System")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t(
											"Multi-level roles: Members, Managers, and Club Owners with custom permissions",
										)}
									</p>
								</div>
							</Link>

							<Link
								href="/events"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Calendar className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Attendance Tracking")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Track member attendance at events and matches automatically")}
									</p>
								</div>
							</Link>

							<Link
								href="/clubs"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Lock className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Private Events & Clubs")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Create private, invite-only events and exclusive club spaces")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Mail className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Smart Invite System")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Invite members with unique codes and automated email reminders")}
									</p>
								</div>
							</Link>

							<Link
								href="/events"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<ClipboardList className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Custom Event Rules")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Create and enforce specific rules for each event")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<TrendingUp className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Advanced Statistics")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Track member growth, event participation, and engagement metrics")}
									</p>
								</div>
							</Link>

							<Link
								href="/clubs"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<UserCheck className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Verified Club Badges")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Official verification system for legitimate clubs and organizations")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Ban className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Moderation Tools")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Ban management, reporting system, and content moderation")}
									</p>
								</div>
							</Link>

							<Link
								href="/map"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Pencil className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Event Map Drawing")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Create detailed maps for events with custom zones, paths, and spawn areas")}
									</p>
								</div>
							</Link>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4 opacity-80">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Users className="h-5 w-5 text-red-500" />
									</div>
									<Badge variant="outline" className="text-xs">
										{t("Planned")}
									</Badge>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Alliance Management")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t(
											"Alliances managed by elected officials with dedicated tools and permissions",
										)}
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* For Players */}
					<div className="space-y-6">
						<h3 className="text-2xl">{t("For Players")}</h3>
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<User className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Customizable Profile")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Personalize your profile with bio, photos, gear, and social links")}
									</p>
								</div>
							</Link>

							<Link
								href="/users"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Star className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("360° Review System")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Rate and review players, clubs, and events to build trust")}
									</p>
								</div>
							</Link>

							<Link
								href="/events"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Users className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Team Registration System")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Advanced team-based registration with squad management for events")}
									</p>
								</div>
							</Link>

							<Link
								href="/users"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<MapIcon className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Play History")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Track where you've played, events attended, and clubs represented")}
									</p>
								</div>
							</Link>

							<Link
								href="/users"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Building2 className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Club Representation")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Show off your club affiliation and represent your team proudly")}
									</p>
								</div>
							</Link>

							<Link
								href="/users"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Link2 className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Social Links")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Connect your Instagram, YouTube, and other social media to your profile")}
									</p>
								</div>
							</Link>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4 opacity-80">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Trophy className="h-5 w-5 text-red-500" />
									</div>
									<Badge variant="outline" className="text-xs">
										{t("Planned")}
									</Badge>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Gear Showcase")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Show off your loadout, replicas, and equipment to the community")}
									</p>
								</div>
							</div>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4 opacity-80">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<MapPin className="h-5 w-5 text-red-500" />
									</div>
									<Badge variant="outline" className="text-xs">
										{t("Planned")}
									</Badge>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Realtime Event Map")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Live map with player locations, drawing tools, and squad-like tracking")}
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* For Everyone */}
					<div className="space-y-6">
						<h3 className="text-2xl">{t("For Everyone")}</h3>
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							<Link
								href="/map"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Globe className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Club Map")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Find clubs and events near you on our interactive map")}
									</p>
								</div>
							</Link>

							<Link
								href="/dashboard"
								className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4"
							>
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Shield className="h-5 w-5 text-red-500" />
									</div>
									<Zap className="h-4 w-4 text-red-500/50 opacity-0 group-hover:opacity-100 transition-opacity" />
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Passkey Authentication")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Secure, passwordless login with modern passkey technology")}
									</p>
								</div>
							</Link>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Search className="h-5 w-5 text-red-500" />
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("SEO Friendly")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Fully indexed and discoverable by search engines and AI assistants")}
									</p>
								</div>
							</div>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Code2 className="h-5 w-5 text-red-500" />
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Open Source")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("100% open source, transparent, and community-driven development")}
									</p>
								</div>
							</div>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<DollarSign className="h-5 w-5 text-red-500" />
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Free Forever")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Core features are and always will be completely free to use")}
									</p>
								</div>
							</div>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Building2 className="h-5 w-5 text-red-500" />
									</div>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Centralized Information")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Everything about airsoft in one place - clubs, events, players, and more")}
									</p>
								</div>
							</div>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4 opacity-80">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Settings className="h-5 w-5 text-red-500" />
									</div>
									<Badge variant="outline" className="text-xs">
										{t("Planned")}
									</Badge>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("Data Export")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Download all your data anytime in portable formats")}
									</p>
								</div>
							</div>

							<div className="group relative overflow-hidden rounded-lg border bg-card p-6 hover:border-red-500 transition-all duration-200 flex flex-col gap-4 opacity-80">
								<div className="flex items-start justify-between">
									<div className="rounded-md bg-red-500/10 p-2">
										<Code2 className="h-5 w-5 text-red-500" />
									</div>
									<Badge variant="outline" className="text-xs">
										{t("Planned")}
									</Badge>
								</div>
								<div className="space-y-2">
									<h3 className="font-semibold leading-tight">{t("API Access")}</h3>
									<p className="text-sm text-muted-foreground leading-snug">
										{t("Personal API tokens for developers and integrations")}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
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
