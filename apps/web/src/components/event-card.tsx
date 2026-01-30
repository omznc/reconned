"use client";

import { format } from "date-fns";
import { ArrowUpRight, CalendarDays, Clock, DollarSign, MapPin } from "lucide-react";
import Image from "next/image";
import { useExtracted, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getDateFnsLocale } from "@/lib/date-locale";

interface EventCardProps {
	event: {
		id: string;
		slug: string | null;
		name: string;
		description: string | null;
		image: string | null;
		dateStart: string;
		dateEnd: string | null;
		location: string;
		costPerPerson: number;
		allowFreelancers: boolean;
		hasBreakfast: boolean;
		hasLunch: boolean;
		hasDinner: boolean;
		hasSnacks: boolean;
		hasDrinks: boolean;
		hasPrizes: boolean;
		isPrivate: boolean;
		club?: {
			name: string;
		} | null;
	};
}

export function EventCard({ event }: EventCardProps) {
	const t = useExtracted();
	const locale = useLocale();
	const dateFnsLocale = getDateFnsLocale(locale);

	const dateStart = new Date(event.dateStart);
	const dateEnd = event.dateEnd ? new Date(event.dateEnd) : null;

	return (
		<Link href={`/events/${event.slug || event.id}`} className="block group h-full">
			<Card className="relative flex flex-col h-full rounded-md overflow-hidden bg-sidebar hover:border-red-500 transition-all">
				<CardHeader className="p-0">
					{event.image && (
						<div className="relative w-full aspect-video">
							<Image
								src={event.image}
								alt={event.name}
								fill
								className="object-cover"
								sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
							/>
						</div>
					)}
					<CardTitle className="mt-4 px-6">{event.name}</CardTitle>
					<CardDescription className="px-6 pb-6 line-clamp-2">{event.description}</CardDescription>
				</CardHeader>

				<CardContent className="grow flex-col flex gap-1">
					<div className="flex items-center">
						<CalendarDays className="w-5 h-5 mr-2 text-muted-foreground" />
						<span>
							{format(dateStart, "MMM d, yyyy", { locale: dateFnsLocale })}
							{dateEnd && ` - ${format(dateEnd, "MMM d, yyyy", { locale: dateFnsLocale })}`}
						</span>
					</div>
					<div className="flex items-center">
						<Clock className="w-5 h-5 mr-2 text-muted-foreground" />
						<span>{format(dateStart, "h:mm a", { locale: dateFnsLocale })}</span>
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

					<div className="flex-1" />

					<div className="flex flex-wrap gap-2 my-4">
						<Badge variant="outline" className="grow justify-center">
							{event.allowFreelancers ? t("Freelancers allowed") : t("For members only")}
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

					<ArrowUpRight className="absolute top-4 right-4 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</CardContent>
			</Card>
		</Link>
	);
}
