"use client";

import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { CalendarDays, Clock, DollarSign, MapPin } from "lucide-react";
import Image from "next/image";
import { useExtracted, useLocale } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { getDateFnsLocale } from "@/lib/date-locale";

const ITEMS_PER_PAGE = 12;

type EventsResponse = ApiResponse<"/api/events", "get">;

interface EventsListingProps {
	initialData: EventsResponse;
}

export function EventsListing({ initialData }: EventsListingProps) {
	const t = useExtracted();
	const locale = useLocale();
	const dateFnsLocale = getDateFnsLocale(locale);
	const [page, setPage] = useQueryState(
		"page",
		parseAsInteger.withDefault(1).withOptions({
			shallow: true,
			history: "replace",
		}),
	);

	const { data, isLoading } = useQuery<EventsResponse>({
		queryKey: ["events", "list", page],
		queryFn: async () => {
			const { data, error } = await apiClient.GET("/api/events", {
				params: {
					query: {
						page: String(page),
						perPage: String(ITEMS_PER_PAGE),
						sortBy: "dateStart",
						sortOrder: "asc",
					},
				},
			});
			if (error || !data) {
				throw new Error("Failed to load events");
			}
			return data;
		},
		initialData: page === 1 ? initialData : undefined,
		placeholderData: (previousData) => previousData,
	});

	const events = data?.events || [];
	const pagination = data?.pagination || initialData.pagination;
	const totalPages = pagination.totalPages;

	return (
		<div className="container max-w-7xl py-8 px-4 space-y-8">
			<div className="space-y-6">
				<h1 className="text-3xl font-bold tracking-tight">{t("Upcoming events")}</h1>

				{isLoading && events.length === 0 ? (
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
							<Card key={i} className="flex flex-col overflow-hidden">
								<CardHeader className="p-0">
									<Skeleton className="w-full aspect-video" />
									<div className="px-6 pt-6">
										<Skeleton className="h-6 w-3/4 mb-2" />
										<Skeleton className="h-4 w-full" />
									</div>
								</CardHeader>
								<CardContent className="flex-1 flex flex-col gap-3 px-6 pt-4">
									<Skeleton className="h-4 w-2/3" />
									<Skeleton className="h-4 w-1/2" />
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-4 w-2/3" />
									<div className="flex flex-wrap gap-2 mt-2">
										<Skeleton className="h-5 w-20" />
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-5 w-18" />
									</div>
								</CardContent>
								<CardFooter className="flex flex-col gap-3 px-6 pb-6">
									<Skeleton className="h-3 w-full" />
									<Skeleton className="h-3 w-3/4" />
									<Skeleton className="h-10 w-full" />
								</CardFooter>
							</Card>
						))}
					</div>
				) : events.length === 0 ? (
					<div className="text-center py-12 text-muted-foreground">
						<p>{t("There are no upcoming events")}</p>
					</div>
				) : (
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{events.map((event) => {
							const dateStart = new Date(event.dateStart);
							const dateEnd = event.dateEnd ? new Date(event.dateEnd) : null;
							const dateRegistrationsClose = event.dateRegistrationsClose
								? new Date(event.dateRegistrationsClose)
								: null;

							return (
								<Card
									key={event.id}
									className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow"
								>
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
										<div className="px-6 pt-6">
											<CardTitle className="text-xl mb-2">{event.name}</CardTitle>
											{event.description && (
												<CardDescription className="line-clamp-2">
													{event.description}
												</CardDescription>
											)}
										</div>
									</CardHeader>
									<CardContent className="flex-1 flex flex-col gap-3 px-6 pt-4">
										<div className="flex items-center gap-2 text-sm">
											<CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
											<span>
												{format(dateStart, "MMM d, yyyy")}
												{dateEnd && ` - ${format(dateEnd, "MMM d, yyyy")}`}
											</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<Clock className="w-4 h-4 text-muted-foreground shrink-0" />
											<span>{format(dateStart, "h:mm a")}</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
											<span className="truncate">{event.location}</span>
										</div>
										<div className="flex items-center gap-2 text-sm">
											<DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
											<span>
												{event.costPerPerson.toFixed(2)}KM {t("per person")}
											</span>
										</div>
										<div className="flex flex-wrap gap-2 mt-2">
											<Badge variant="outline" className="text-xs">
												{event.allowFreelancers
													? t("Freelancer-friendly")
													: t("No freelancers")}
											</Badge>
											{event.hasBreakfast && (
												<Badge variant="outline" className="text-xs">
													{t("Breakfast")}
												</Badge>
											)}
											{event.hasLunch && (
												<Badge variant="outline" className="text-xs">
													{t("Lunch")}
												</Badge>
											)}
											{event.hasDinner && (
												<Badge variant="outline" className="text-xs">
													{t("Dinner")}
												</Badge>
											)}
											{event.hasSnacks && (
												<Badge variant="outline" className="text-xs">
													{t("Snacks")}
												</Badge>
											)}
											{event.hasDrinks && (
												<Badge variant="outline" className="text-xs">
													{t("Drinks")}
												</Badge>
											)}
											{event.hasPrizes && (
												<Badge variant="outline" className="text-xs">
													{t("Prizes")}
												</Badge>
											)}
										</div>
									</CardContent>
									<CardFooter className="flex flex-col gap-3 px-6 pb-6">
										<div className="text-xs text-muted-foreground w-full">
											{t("Starts")}{" "}
											{formatDistanceToNow(dateStart, {
												addSuffix: true,
												locale: dateFnsLocale,
											})}
										</div>
										{dateRegistrationsClose && (
											<div className="text-xs text-muted-foreground w-full">
												{t("Registrations open for")}{" "}
												{formatDistanceToNow(dateRegistrationsClose, {
													locale: dateFnsLocale,
												})}
											</div>
										)}
										<Button asChild className="w-full">
											<Link href={`/events/${event.slug || event.id}`}>{t("View")}</Link>
										</Button>
									</CardFooter>
								</Card>
							);
						})}
					</div>
				)}
			</div>

			{totalPages > 1 && (
				<div className="flex items-center justify-center gap-2">
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage(page - 1)}
						disabled={page <= 1 || isLoading}
					>
						←
					</Button>
					<div className="flex items-center gap-1">
						{Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							let pageNum: number;
							if (totalPages <= 5) {
								pageNum = i + 1;
							} else if (page <= 3) {
								pageNum = i + 1;
							} else if (page >= totalPages - 2) {
								pageNum = totalPages - 4 + i;
							} else {
								pageNum = page - 2 + i;
							}
							return (
								<Button
									key={pageNum}
									variant={page === pageNum ? "default" : "outline"}
									size="icon"
									onClick={() => setPage(pageNum)}
									disabled={isLoading}
								>
									{pageNum}
								</Button>
							);
						})}
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => setPage(page + 1)}
						disabled={page >= totalPages || isLoading}
					>
						→
					</Button>
				</div>
			)}
		</div>
	);
}
