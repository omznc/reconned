import { EventCalendar } from "@/components/event-calendar";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
	startOfMonth,
	endOfMonth,
	subMonths,
	addMonths,
	parse as parseDateFns,
	format,
	formatDistanceToNow,
} from "date-fns";
import { bs } from "date-fns/locale";
import {
	CalendarDays,
	Clock,
	MapPin,
	DollarSign,
	Calendar,
	LayoutDashboard,
	Medal,
	Search,
	Map,
	ShieldQuestion,
	Building2,
	Users,
	MapIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BadgeSoon } from "@/components/badge-soon";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

interface PageProps {
	searchParams: Promise<{
		month?: string;
	}>;
}

export default async function Home({ searchParams }: PageProps) {
	const user = await isAuthenticated();
	const { month } = await searchParams;

	const currentDate = month
		? parseDateFns(month, "yyyy-MM", new Date())
		: new Date();
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
				},
			},
		},
		take: 3,
	});

	const t = await getTranslations('public.home');

	return (
		<>
			<div className="overflow-hidden flex items-center justify-center w-full">
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							{t.rich('hero.title', {
								br: () => <br />,
							})}
						</h1>
						<p className="text-xl text-text/80 mb-8">
							{t('hero.description')}
						</p>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
							<Button size="sm" variant="default" className="aspect-square flex-col h-auto p-2" asChild>
								<Link href="/search">
									<Search className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.search')
									}</span>
								</Link>
							</Button>
							<Button size="sm" variant="outline" className="aspect-square flex-col h-auto p-2" asChild>
								<Link href="/events">
									<Calendar className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.events')
									}</span>
								</Link>
							</Button>
							<Button size="sm" variant="outline" className="aspect-square opacity-50 pointer-events-none flex-col h-auto p-2" asChild>
								<Link href="#">
									<Building2 className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.clubs')
									}</span>
									<BadgeSoon />
								</Link>
							</Button>
							<Button size="sm" variant="outline" className="aspect-square opacity-50 pointer-events-none flex-col h-auto p-2" asChild>
								<Link href="#">
									<Users className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.members')
									}</span>
									<BadgeSoon />
								</Link>
							</Button>
							<Button size="sm" variant="default" className="aspect-square flex-col h-auto p-2" asChild>
								<Link href="/map">
									<MapIcon className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.map')
									}</span>
								</Link>
							</Button>
							<Button size="sm" variant="outline" className="aspect-square flex-col h-auto p-2" asChild>
								<Link href="/about">
									<ShieldQuestion className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.about')
									}</span>
								</Link>
							</Button>
							<Button size="sm" variant="outline" className="aspect-square flex-col h-auto p-2" asChild>
								<Link href="/dashboard">
									<LayoutDashboard className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.dashboard')
									}</span>
								</Link>
							</Button>
							<Button size="sm" variant="outline" className="aspect-square flex-col h-auto p-2" asChild>
								<Link href="/sponsors">
									<Medal className="scale-150 mb-2" />
									<span className="text-sm">{
										t('hero.sponsors')
									}</span>
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-8">
				<div className="flex flex-col gap-4">
					<div>
						<h2 className="text-2xl font-bold">{t('upcomingEventsTitle')}</h2>
						<p className="text-gray-400">{t('upcomingEventsSubtitle')}</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{upcomingEvents.length === 0 && (
							<div className="text-muted-foreground">
								{t('upcomingEventsNone')}
							</div>
						)}

						{upcomingEvents.map((event) => (
							<Card key={event.id} className="flex flex-col bg-sidebar">
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
									<CardDescription className="px-6 pb-6">
										{event.description}
									</CardDescription>
								</CardHeader>
								<CardContent className="flex-grow flex-col flex gap-1">
									<div className="flex items-center">
										<CalendarDays className="w-5 h-5 mr-2 text-muted-foreground" />
										<span>
											{format(event.dateStart, "MMM d, yyyy")}
											{event.dateEnd &&
												` - ${format(event.dateEnd, "MMM d, yyyy")}`}
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
											<span>{event.costPerPerson.toFixed(2)}KM po osobi</span>
										</div>
									)}
									<div className="flex flex-wrap gap-2 my-4">
										<Badge
											variant="outline"
											className="flex-grow justify-center"
										>
											{event.allowFreelancers
												? t('eventCard.canFreelance')
												: t('eventCard.cannotFreelance')}
										</Badge>
										{event.hasBreakfast && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												{t('eventCard.breakfast')}
											</Badge>
										)}
										{event.hasLunch && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												{t('eventCard.lunch')}
											</Badge>
										)}
										{event.hasDinner && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												{t('eventCard.dinner')}
											</Badge>
										)}
										{event.hasSnacks && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												{t('eventCard.snacks')}
											</Badge>
										)}
										{event.hasDrinks && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												{t('eventCard.drinks')}
											</Badge>
										)}
										{event.hasPrizes && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												{t('eventCard.prizes')}
											</Badge>
										)}
									</div>
									{event.isPrivate && (
										<span className="text-xs text-muted-foreground">
											{t('eventCard.private', {
												club: event.club?.name,
											})}
										</span>
									)}
								</CardContent>
								<CardFooter className="flex justify-between items-center">
									<div className="flex flex-col">
										<div className="text-sm text-muted-foreground">
											{t('eventCard.starts')}{" "}
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
									<Button asChild={true}>
										<Link href={`/events/${event.id}`}>{
											t('eventCard.view')
										}</Link>
									</Button>
								</CardFooter>
							</Card>
						))}
					</div>
				</div>
				<EventCalendar events={events} />
			</div>
		</>
	);
}
