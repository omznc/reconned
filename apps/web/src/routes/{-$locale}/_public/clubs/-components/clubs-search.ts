import * as z from "zod";

export const CLUBS_PER_PAGE = 12;

export const CLUB_SORTS = ["members", "rating", "newest", "name"] as const;
export const CLUB_SIZES = ["small", "medium", "large"] as const;

const flag = z.literal(true).optional().catch(undefined);

/** The URL state of the clubs listing. Every field maps to a backend parameter. */
export const clubsSearchSchema = z.object({
	page: z.coerce.number().int().positive().optional().catch(undefined),
	q: z.coerce.string().optional().catch(undefined),
	sort: z.enum(CLUB_SORTS).optional().catch(undefined),
	country: z.coerce.number().int().optional().catch(undefined),
	size: z.enum(CLUB_SIZES).optional().catch(undefined),
	city: z.coerce.string().optional().catch(undefined),
	verified: flag,
	allied: flag,
	hasGames: flag,
});

export type ClubsSearch = z.infer<typeof clubsSearchSchema>;

const SORT_QUERY = {
	members: { sortBy: "members", sortOrder: "desc" },
	rating: { sortBy: "rating", sortOrder: "desc" },
	newest: { sortBy: "newest", sortOrder: "desc" },
	name: { sortBy: "name", sortOrder: "asc" },
} as const;

/** Map the URL state to the query of `GET /api/clubs`. */
export function toClubsQuery(search: ClubsSearch, perPage: number) {
	return {
		page: String(search.page ?? 1),
		perPage: String(perPage),
		...(search.sort ? SORT_QUERY[search.sort] : {}),
		...(search.q ? { search: search.q } : {}),
		...(search.country ? { countryId: search.country } : {}),
		...(search.size ? { size: search.size } : {}),
		...(search.city ? { city: search.city } : {}),
		...(search.verified ? { verified: "true" } : {}),
		...(search.allied ? { allied: "true" } : {}),
		...(search.hasGames ? { hasGames: "true" } : {}),
		facets: "true",
	};
}
