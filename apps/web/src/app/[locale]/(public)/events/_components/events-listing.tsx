"use client";

import { useQuery } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { EventCard } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

const ITEMS_PER_PAGE = 12;

type EventsResponse = ApiResponse<"/api/events", "get">;

interface EventsListingProps {
	initialData: EventsResponse;
}

export function EventsListing({ initialData }: EventsListingProps) {
	const t = useExtracted();
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
						{events.map((event) => (
							<EventCard key={event.id} event={event} />
						))}
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
