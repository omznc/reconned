"use client";

import NoResults from "@public/errors/no-results.png";
import { useInfiniteQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef } from "react";
import { ListingCard } from "@/components/listing-card";
import { ListingCardSkeleton } from "@/components/listing-card-skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

const ITEMS_PER_PAGE = 20;

/*
 * Search mixes clubs, people and events, and their card shapes have wildly
 * different natural heights — a grid of them left ragged holes wherever a
 * person landed next to a club. Rows give every result the same height and let
 * each type keep its own leading mark, which is the part that tells them apart.
 */
const RESULT_GRID = "grid grid-cols-1 gap-3 lg:grid-cols-2";

type SearchResponse = ApiResponse<"/api/search", "get">;
type SearchItem = NonNullable<SearchResponse["items"]>[number];

export function SearchResults() {
	const t = useExtracted();
	const [query] = useQueryState("q", { defaultValue: "" });
	const [filterClubs] = useQueryState("filterClubs", parseAsBoolean.withDefault(true));
	const [filterUsers] = useQueryState("filterUsers", parseAsBoolean.withDefault(true));
	const [filterEvents] = useQueryState("filterEvents", parseAsBoolean.withDefault(true));
	const loadMoreRef = useRef<HTMLDivElement>(null);

	const filterString = useMemo(() => {
		const filters: string[] = [];
		if (filterClubs) {
			filters.push("club");
		}
		if (filterUsers) {
			filters.push("user");
		}
		if (filterEvents) {
			filters.push("event");
		}
		return filters.join(",");
	}, [filterClubs, filterUsers, filterEvents]);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery({
		queryKey: ["search", query, filterString],
		queryFn: async ({ pageParam = 1 }) => {
			const result = await apiClient.GET("/api/search", {
				params: {
					query: {
						...(query ? { search: query } : {}),
						...(filterString ? { filter: filterString } : {}),
						page: String(pageParam),
						perPage: String(ITEMS_PER_PAGE),
					},
				},
			});
			return (
				result.data || { items: [], pagination: { page: 1, perPage: ITEMS_PER_PAGE, total: 0, totalPages: 0 } }
			);
		},
		getNextPageParam: (lastPage) => {
			if (!lastPage?.pagination) {
				return undefined;
			}
			const totalPages = lastPage.pagination.totalPages || 0;
			const currentPage = lastPage.pagination.page || 1;
			return currentPage < totalPages ? currentPage + 1 : undefined;
		},
		enabled: filterString.length > 0,
		initialPageParam: 1,
	});

	const allItems = useMemo(() => {
		const items: SearchItem[] = [];
		if (data) {
			for (const page of data.pages) {
				for (const item of page.items || []) {
					items.push(item);
				}
			}
		}
		return items;
	}, [data]);

	useEffect(() => {
		if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1 },
		);

		observer.observe(loadMoreRef.current);

		return () => {
			observer.disconnect();
		};
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	return (
		<TooltipProvider>
			<div className="space-y-4">
				{isLoading && allItems.length === 0 ? (
					<div className={RESULT_GRID}>
						{Array.from({ length: 12 }).map((_, i) => (
							<ListingCardSkeleton
								key={i}
								variant="row"
								type={i % 3 === 0 ? "event" : i % 3 === 1 ? "club" : "user"}
							/>
						))}
					</div>
				) : error ? (
					<div className="text-center text-destructive py-16" role="alert">
						{t("Unable to load search results. Check your connection and try again.")}
					</div>
				) : allItems.length === 0 ? (
					<div className="text-center py-16 flex flex-col items-center justify-center">
						<Image src={NoResults} alt="" draggable={false} className="w-full max-w-[250px] dark:invert" />
						<p className="mt-4 font-medium">{t("No results for “{query}”", { query })}</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("Try a shorter term, or turn on more filters to widen the search.")}
						</p>
					</div>
				) : (
					<>
						<div className={RESULT_GRID}>
							{allItems.map((item) => {
								if (item.type === "club") {
									const club = item.data as Extract<SearchItem, { type: "club" }>["data"];
									return (
										<ListingCard
											key={`club-${item.id}`}
											variant="row"
											type="club"
											image={club.logo}
											tile={club.logoTile}
											title={club.name}
											href={`/clubs/${club.slug || club.id}`}
											verified={club.verified}
											memberCount={club._count.members}
											meta={club.location || undefined}
										/>
									);
								}
								if (item.type === "user") {
									const user = item.data as Extract<SearchItem, { type: "user" }>["data"] & {
										clubMembership?: Array<{ club: { name: string } }>;
									};
									return (
										<ListingCard
											key={`user-${item.id}`}
											variant="row"
											type="user"
											image={user.image}
											name={user.name}
											title={user.name}
											description={user.callsign}
											href={`/users/${user.slug || user.id}`}
											meta={user.location || undefined}
											isAdmin={user.role === "admin"}
											badges={
												user.role === "admin"
													? ["Admin"]
													: user.clubMembership && user.clubMembership.length > 0
														? user.clubMembership.map((m) => m.club.name)
														: undefined
											}
										/>
									);
								}
								if (item.type === "event") {
									const event = item.data as Extract<SearchItem, { type: "event" }>["data"] & {
										club?: { name: string };
									};
									return (
										<ListingCard
											key={`event-${item.id}`}
											variant="row"
											type="event"
											image={event.image || undefined}
											title={event.name}
											description={event.description || undefined}
											href={`/events/${event.slug || event.id}`}
											location={event.location || undefined}
											badges={[
												event.club?.name || "",
												event.isPrivate ? "Private" : "Public",
											].filter(Boolean)}
										/>
									);
								}
								return null;
							})}
						</div>

						{isFetchingNextPage && (
							<div className={RESULT_GRID}>
								{Array.from({ length: 4 }).map((_, i) => (
									<ListingCardSkeleton key={`loading-${i}`} variant="row" type="club" />
								))}
							</div>
						)}

						{hasNextPage && <div ref={loadMoreRef} className="h-4" />}
					</>
				)}
			</div>
		</TooltipProvider>
	);
}
