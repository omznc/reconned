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
	Wrench,
	LayoutDashboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

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

	return (
		<>
			<div className="relative overflow-hidden flex items-center justify-center w-full">
				<div className="absolute inset-0 bg-gradient-to-b from-red-600/20 to-transparent" />
				<div className="container mx-auto px-4 py-24 max-w-[1200px]">
					<div className="relative max-w-2xl">
						<h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
							Samo Airsoft, <br /> ali bolje.
						</h1>
						<p className="text-xl text-text/80 mb-8">
							Pridružite se najnaprednijoj airsoft zajednici. Pronađite
							događaje, povežite se s igračima i unaprijedite svoju igru.
						</p>
						<div className="flex flex-wrap gap-4">
							<Button size="lg" className="bg-red-600 hover:bg-red-700" asChild>
								<Link href="/events">
									<Calendar className="mr-2 h-4 w-4" />
									Pregledaj događaje
								</Link>
							</Button>
							<Button size="lg" variant="outline" asChild>
								<Link href="/dashboard">
									<LayoutDashboard className="mr-2 h-4 w-4" />
									Otvori aplikaciju
								</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col size-full gap-8 max-w-[1200px] px-4 py-8">
				<div className="flex flex-col gap-4">
					<div>
						<h2 className="text-2xl font-bold">Nadolazeći susreti</h2>
						<p className="text-gray-400">Vidimo se na terenu</p>
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{upcomingEvents.length === 0 && (
							<div className="text-muted-foreground">
								Trenutno nema nadolazećih događaja.
							</div>
						)}

						{upcomingEvents.map((event) => (
							<Card key={event.id} className="flex flex-col bg-sidebar">
								<CardHeader className="p-0">
									{event.coverImage && (
										<Image
											src={event.coverImage}
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
												? "Dozvoljeni freelanceri"
												: "Samo klubovi"}
										</Badge>
										{event.hasBreakfast && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												Doručak
											</Badge>
										)}
										{event.hasLunch && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												Ručak
											</Badge>
										)}
										{event.hasDinner && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												Večera
											</Badge>
										)}
										{event.hasSnacks && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												Grickalice
											</Badge>
										)}
										{event.hasDrinks && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												Pića
											</Badge>
										)}
										{event.hasPrizes && (
											<Badge
												variant="outline"
												className="flex-grow justify-center"
											>
												Nagrade
											</Badge>
										)}
									</div>
									{event.isPrivate && (
										<span className="text-xs text-muted-foreground">
											Ovo je privatan susret, ali ste vi u klubu{" "}
											{event.club?.name}S.
										</span>
									)}
								</CardContent>
								<CardFooter className="flex justify-between items-center">
									<div className="flex flex-col">
										<div className="text-sm text-muted-foreground">
											Kreće{" "}
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
										<Link href={`/events/${event.id}`}>Pogledaj</Link>
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
