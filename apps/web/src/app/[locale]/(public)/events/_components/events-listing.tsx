"use client";

import NoResults from "@public/errors/no-results.png";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { parseAsInteger, useQueryState } from "nuqs";
import { EventCard } from "@/components/event-card";
import { Button } from "@/components/ui/button";
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
		<div className="container max-w-7xl py-8 px-4">
			<div className="space-y-6">
				<h1 className="text-2xl font-bold tracking-tight">{t("Upcoming events")}</h1>

				{isLoading && events.length === 0 ? (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
							<div key={i} className="rounded-lg overflow-hidden border border-border/50">
								<Skeleton className="w-full aspect-[4/3]" />
								<div className="p-4 space-y-2">
									<Skeleton className="h-5 w-3/4" />
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-2/3" />
									<div className="flex gap-1.5 pt-2">
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-5 w-20" />
									</div>
								</div>
							</div>
						))}
					</div>
				) : events.length === 0 ? (
					<div className="text-center py-16 flex flex-col items-center justify-center">
						<Image
							src={NoResults}
							alt="No results"
							draggable={false}
							className="w-full max-w-[250px] dark:invert"
						/>
						<p className="mt-4 text-muted-foreground">{t("There are no upcoming events")}</p>
					</div>
				) : (
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{events.map((event) => (
							<EventCard key={event.id} event={event} />
						))}
					</div>
				)}
			</div>

			<div className="min-h-[60px] flex items-center justify-center mt-8">
				{totalPages > 1 && (
					<div className="flex items-center justify-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onClick={() => setPage(page - 1)}
							disabled={page <= 1 || isLoading}
							className="transition-all duration-200 hover:scale-110 active:scale-95"
						>
							<ChevronLeft className="h-4 w-4" />
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
										className="transition-all duration-200 hover:scale-110 active:scale-95"
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
							className="transition-all duration-200 hover:scale-110 active:scale-95"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
