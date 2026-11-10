import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { refineQuery, type SearchParams } from "@/routes/{-$locale}/_public/search/-components/search-state";

export type SearchResponse = ApiResponse<"/api/search", "get">;
export type SearchItem = SearchResponse["items"][number];
export type ClubItem = Extract<SearchItem, { type: "club" }>;
export type UserItem = Extract<SearchItem, { type: "user" }>;
export type EventItem = Extract<SearchItem, { type: "event" }>;

const TAB_PAGE_SIZE = 20;
const SECTION_SIZE = { event: 5, club: 6, user: 6 } as const;
const TAB_FILTER = { events: "event", clubs: "club", players: "user" } as const;

async function fetchSearch(params: SearchParams, filter: string, page: number, perPage: number) {
	const { data, error } = await apiClient.GET("/api/search", {
		params: {
			query: {
				...(params.q ? { search: params.q } : {}),
				...refineQuery(params),
				filter,
				page,
				perPage,
			},
		},
	});
	if (error || !data) {
		throw new Error("search failed");
	}
	return data;
}

/** The counts for the tabs, and the top result. One small request. */
export function useSearchSummary(params: SearchParams) {
	return useQuery({
		queryKey: ["search", "summary", params.q, params.country, params.upcoming, params.open, params.verified],
		queryFn: () => fetchSearch(params, "club,user,event", 1, 1),
		placeholderData: keepPreviousData,
	});
}

/** The three sections of the "All" tab. */
export function useSearchSections(params: SearchParams) {
	return useQuery({
		queryKey: ["search", "sections", params.q, params.country, params.upcoming, params.open, params.verified],
		enabled: params.tab === "all",
		placeholderData: keepPreviousData,
		queryFn: async () => {
			const [events, clubs, users] = await Promise.all([
				fetchSearch(params, "event", 1, SECTION_SIZE.event),
				fetchSearch(params, "club", 1, SECTION_SIZE.club),
				fetchSearch(params, "user", 1, SECTION_SIZE.user),
			]);
			return {
				events: events.items.filter((item): item is EventItem => item.type === "event"),
				clubs: clubs.items.filter((item): item is ClubItem => item.type === "club"),
				users: users.items.filter((item): item is UserItem => item.type === "user"),
			};
		},
	});
}

/** One type of result with a "Show more" button. */
export function useSearchTab(params: SearchParams) {
	const filter = params.tab === "all" ? "event" : TAB_FILTER[params.tab];
	return useInfiniteQuery({
		queryKey: ["search", "tab", filter, params.q, params.country, params.upcoming, params.open, params.verified],
		enabled: params.tab !== "all",
		initialPageParam: 1,
		queryFn: ({ pageParam }) => fetchSearch(params, filter, pageParam, TAB_PAGE_SIZE),
		getNextPageParam: (last) =>
			last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined,
	});
}

/** The ids of the countries in the Refine chips. */
export function useCountryIds() {
	return useQuery({
		queryKey: ["countries"],
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async () => {
			const { data } = await apiClient.GET("/api/countries");
			const ids = new Map<string, number>();
			for (const country of data ?? []) {
				ids.set(country.iso2, country.id);
			}
			return ids;
		},
	});
}
