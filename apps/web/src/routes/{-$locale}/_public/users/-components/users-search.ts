import * as z from "zod";

export const USERS_PER_PAGE = 12;

export const USER_SORTS = ["games", "name", "newest"] as const;

/** The URL state of the players listing. Every field maps to a backend parameter. */
export const usersSearchSchema = z.object({
	page: z.coerce.number().int().positive().optional().catch(undefined),
	q: z.coerce.string().optional().catch(undefined),
	sort: z.enum(USER_SORTS).optional().catch(undefined),
	country: z.coerce.number().int().optional().catch(undefined),
	club: z.coerce.string().optional().catch(undefined),
	city: z.coerce.string().optional().catch(undefined),
});

export type UsersSearch = z.infer<typeof usersSearchSchema>;

/** Map the URL state to the query of `GET /api/users`. The default order keeps admins first. */
export function toUsersQuery(search: UsersSearch, perPage: number) {
	return {
		page: String(search.page ?? 1),
		perPage: String(perPage),
		sort: search.sort ?? ("admin" as const),
		...(search.q ? { search: search.q } : {}),
		...(search.country ? { countryId: search.country } : {}),
		...(search.club ? { clubId: search.club } : {}),
		...(search.city ? { city: search.city } : {}),
	};
}
