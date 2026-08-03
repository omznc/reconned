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
import { Link } from "@/i18n/navigation";
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
						<Image src={NoResults} alt="" draggable={false} className="w-full max-w-[250px] dark:invert" />
						<p className="mt-4 font-medium">{t("No upcoming events")}</p>
						<p className="mt-1 text-sm text-muted-foreground max-w-sm">
							{t("Clubs post their events here as soon as the dates are set.")}
						</p>
						<Link href="/clubs" className="mt-4 text-sm underline underline-offset-4">
							{t("Browse clubs")}
						</Link>
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
					<nav className="flex items-center justify-center gap-2" aria-label={t("Pagination")}>
						<Button
							variant="outline"
							size="icon"
							onClick={() => setPage(page - 1)}
							disabled={page <= 1 || isLoading}
							aria-label={t("Previous page")}
							className="transition-transform active:scale-[0.96]"
						>
							<ChevronLeft className="h-4 w-4" aria-hidden />
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
										aria-label={t("Page {page}", { page: String(pageNum) })}
										aria-current={page === pageNum ? "page" : undefined}
										className="tabular-nums transition-transform active:scale-[0.96]"
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
							aria-label={t("Next page")}
							className="transition-transform active:scale-[0.96]"
						>
							<ChevronRight className="h-4 w-4" aria-hidden />
						</Button>
					</nav>
				)}
			</div>
		</div>
	);
}
