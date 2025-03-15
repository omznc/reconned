import { Button } from "@/components/ui/button";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { format, formatDistanceToNow } from "date-fns";
import { bs } from "date-fns/locale";
import { CalendarDays, Clock, MapPin, DollarSign } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { isAuthenticated } from "@/lib/auth";

export default async function Page() {
	const user = await isAuthenticated();
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
	return (
		<div className="flex flex-col gap-4 max-w-[1200px] py-8 px-4">
			<h1 className="text-xl font-bold">Nadolazeći susreti</h1>
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{upcomingEvents.length === 0 && (
					<div className="text-muted-foreground">
						Trenutno nema nadolazećih susreta.
					</div>
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
							<CardDescription className="px-6 pb-6">
								{event.description}
							</CardDescription>
						</CardHeader>
						<CardContent className="grow flex-col flex gap-1">
							<div className="flex items-center">
								<CalendarDays className="w-5 h-5 mr-2 text-muted-foreground" />
								<span>
									{format(event.dateStart, "MMM d, yyyy")}
									{event.dateEnd &&
										` - ${format(event.dateEnd, "MMM d, yyyy")}`}
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
								<span>{event.costPerPerson.toFixed(2)}KM po osobi</span>
							</div>
							<div className="flex flex-wrap gap-2 my-4">
								<Badge className="grow justify-center">
									{event.allowFreelancers
										? "Dozvoljeni freelanceri"
										: "Samo klubovi"}
								</Badge>
								{event.hasBreakfast && (
									<Badge className="grow justify-center">Doručak</Badge>
								)}
								{event.hasLunch && (
									<Badge className="flex-growjustify-center ">Ručak</Badge>
								)}
								{event.hasDinner && (
									<Badge className="grow justify-center ">Večera</Badge>
								)}
								{event.hasSnacks && (
									<Badge className="grow justify-center">Grickalice</Badge>
								)}
								{event.hasDrinks && (
									<Badge className="grow justify-center">Pića</Badge>
								)}
								{event.hasPrizes && (
									<Badge className="grow justify-center ">Nagrade</Badge>
								)}
							</div>
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
									<div className="text-sm text-muted-foreground">
										Prijave otvorene još{" "}
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
	);
}
