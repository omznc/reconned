"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useExtracted } from "next-intl";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef } from "react";
import { SearchResultCard } from "@/app/[locale]/(public)/search/_components/search-result-card";
import { SearchResultCardSkeleton } from "@/app/[locale]/(public)/search/_components/search-result-card-skeleton";
import { AdminIcon, VerifiedClubIcon } from "@/components/icons";
import { TooltipProvider } from "@/components/ui/tooltip";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

const ITEMS_PER_PAGE = 20;

type SearchResponse = ApiResponse<"/api/search", "get">;
type SearchItem = NonNullable<SearchResponse["items"]>[number];

export function SearchResults() {
	const [query] = useQueryState("q", { defaultValue: "" });
	const [filterClubs] = useQueryState("filterClubs", parseAsBoolean.withDefault(true));
	const [filterUsers] = useQueryState("filterUsers", parseAsBoolean.withDefault(true));
	const [filterEvents] = useQueryState("filterEvents", parseAsBoolean.withDefault(true));
	const t = useExtracted();
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
			if (!query || query.length < 2) {
				return { items: [], pagination: { page: 1, perPage: ITEMS_PER_PAGE, total: 0, totalPages: 0 } };
			}
			const result = await apiClient.GET("/api/search", {
				params: {
					query: {
						search: query,
						filter: filterString || undefined,
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
		enabled: !!query && query.length >= 2 && filterString.length > 0,
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

	if (!query || query.length < 2) {
		return (
			<div className="text-center text-muted-foreground py-12">{t("Enter at least 2 characters to search")}</div>
		);
	}

	return (
		<TooltipProvider>
			<div className="space-y-4">
				{isLoading && allItems.length === 0 ? (
					<div className="grid gap-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<SearchResultCardSkeleton key={i} type="club" />
						))}
					</div>
				) : error ? (
					<div className="text-center text-destructive py-12">{t("Error loading search results")}</div>
				) : allItems.length === 0 ? (
					<div className="text-center text-muted-foreground py-12">
						{t("Nothing was found matching that search")}
					</div>
				) : (
					<>
						<div className="grid gap-4">
							{allItems.map((item) => {
								if (item.type === "club") {
									const club = item.data as Extract<SearchItem, { type: "club" }>["data"];
									return (
										<SearchResultCard
											image={club.logo}
											key={`club-${item.id}`}
											title={
												<span className="flex gap-2 items-center">
													{club.name} {club.verified && <VerifiedClubIcon />}
												</span>
											}
											description={undefined}
											href={`/clubs/${club.slug || club.id}`}
											meta={`${club._count.members} ${
												club._count.members === 1 ? t("member") : t("members")
											}`}
											type="club"
										/>
									);
								}
								if (item.type === "user") {
									const user = item.data as Extract<SearchItem, { type: "user" }>["data"] & {
										clubMembership?: Array<{ club: { name: string } }>;
									};
									return (
										<SearchResultCard
											image={user.image}
											key={`user-${item.id}`}
											title={
												<span className="flex gap-2 items-center">
													{user.name} {user.callsign ? `(${user.callsign})` : ""}{" "}
													{user.role === "admin" && <AdminIcon />}
												</span>
											}
											description={user.bio}
											href={`/users/${user.slug || user.id}`}
											badges={
												user.clubMembership && user.clubMembership.length > 0
													? user.clubMembership.map((membership) => membership.club.name)
													: ["Freelancer"]
											}
											meta={user.location || undefined}
											type="user"
										/>
									);
								}
								if (item.type === "event") {
									const event = item.data as Extract<SearchItem, { type: "event" }>["data"] & {
										club?: { name: string };
									};
									return (
										<SearchResultCard
											image={event.image || undefined}
											key={`event-${item.id}`}
											title={event.name}
											description={event.description || undefined}
											href={`/events/${event.slug || event.id}`}
											badges={[
												event.club?.name || "",
												event.isPrivate ? t("Private") : t("Public"),
												event.dateStart
													? new Date(event.dateStart).toLocaleDateString(undefined, {
															year: "numeric",
															month: "long",
															day: "numeric",
														})
													: "",
											].filter(Boolean)}
											meta={event.location || undefined}
											type="event"
										/>
									);
								}
								return null;
							})}
						</div>

						{isFetchingNextPage && (
							<div className="grid gap-4">
								{Array.from({ length: 2 }).map((_, i) => (
									<SearchResultCardSkeleton key={`loading-${i}`} type="club" />
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
