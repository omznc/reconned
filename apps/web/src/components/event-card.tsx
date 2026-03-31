"use client";

import { format } from "date-fns";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import Image from "next/image";
import { useExtracted, useLocale } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getDateFnsLocale } from "@/lib/date-locale";
import { cn } from "@/lib/utils";

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

	const amenities: string[] = [];
	if (event.hasBreakfast) amenities.push(t("Breakfast"));
	if (event.hasLunch) amenities.push(t("Lunch"));
	if (event.hasDinner) amenities.push(t("Dinner"));
	if (event.hasSnacks) amenities.push(t("Snacks"));
	if (event.hasDrinks) amenities.push(t("Drinks"));
	if (event.hasPrizes) amenities.push(t("Awards"));

	return (
		<Link href={`/events/${event.slug || event.id}`} className="block group">
			<Card className="overflow-hidden transition-all duration-150 hover:border-red-500 border-border/50 h-full relative">
				<div className="absolute inset-0 bg-gradient-to-t from-red-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />
				<div className="flex flex-col h-full relative">
					<div className="relative aspect-video overflow-hidden bg-muted">
						{event.image ? (
							<Image
								src={event.image}
								alt={event.name}
								fill
								className="object-cover"
								sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center">
								<CalendarDays className="w-10 h-10 text-muted-foreground/50" />
							</div>
						)}

						{event.isPrivate && (
							<div className="absolute top-2 right-2 bg-amber-500/90 text-amber-foreground rounded-full px-2 py-0.5 text-xs font-medium shadow-sm">
								{t("Private")}
							</div>
						)}
					</div>

					<CardHeader className="p-3 pb-1">
						<CardTitle className="text-sm font-semibold line-clamp-1">{event.name}</CardTitle>
						{event.club && <p className="text-xs text-muted-foreground">{event.club.name}</p>}
						{event.description && (
							<CardDescription className="line-clamp-1 text-xs mt-0.5">
								{event.description}
							</CardDescription>
						)}
					</CardHeader>

					<div className="px-3 pb-3 pt-0 mt-auto">
						<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
							<div className="flex items-center gap-1">
								<CalendarDays className="w-3 h-3 shrink-0" />
								<span>{format(dateStart, "MMM d, yyyy", { locale: dateFnsLocale })}</span>
							</div>
							<div className="flex items-center gap-1">
								<Clock className="w-3 h-3 shrink-0" />
								<span>{format(dateStart, "h:mm a", { locale: dateFnsLocale })}</span>
							</div>
						</div>

						<div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
							<MapPin className="w-3 h-3 shrink-0" />
							<span className="truncate">{event.location}</span>
						</div>

						{event.costPerPerson > 0 && (
							<div className="text-xs font-medium text-foreground mb-2">
								{event.costPerPerson.toFixed(2)}KM {t("per person")}
							</div>
						)}

						<div className="flex flex-wrap gap-1">
							<Badge
								variant={event.allowFreelancers ? "secondary" : "outline"}
								className={cn(
									"text-xs px-1.5 py-0 font-normal",
									!event.allowFreelancers && "border-amber-500/50 text-amber-600 dark:text-amber-400",
								)}
							>
								{event.allowFreelancers ? t("Freelancers") : t("Members")}
							</Badge>
							{amenities.slice(0, 2).map((amenity) => (
								<Badge key={amenity} variant="secondary" className="text-xs px-1.5 py-0 font-normal">
									{amenity}
								</Badge>
							))}
							{amenities.length > 2 && (
								<Badge variant="secondary" className="text-xs px-1.5 py-0 font-normal">
									+{amenities.length - 2}
								</Badge>
							)}
						</div>
					</div>
				</div>
			</Card>
		</Link>
	);
}
