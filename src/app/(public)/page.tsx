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
import { CalendarDays, Clock, MapPin, DollarSign } from "lucide-react";
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
		<div className="flex flex-col size-full gap-8">
			<div className="flex flex-col gap-4">
				<h1 className="text-xl font-bold">Nadolazeći događaji</h1>
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
									<Badge variant="outline" className="flex-grow justify-center">
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
	);
}
