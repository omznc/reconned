import * as z from "zod";

// The router parses `?page=2` as the number 2, so the values keep both types and are not coerced.
// Coercing would make the router rewrite the URL to `page="2"`.
const queryValue = z.union([z.string(), z.number()]).optional();

/** Search params of every admin and user table page. Other params (`flagId`, `type`, ...) pass through. */
export const listSearchSchema = z.looseObject({
	search: queryValue,
	sortBy: queryValue,
	sortOrder: queryValue,
	page: queryValue,
	perPage: queryValue,
});

export type ListSearch = z.infer<typeof listSearchSchema>;

/** Picks the keys that change the loader result. Pass it the route search plus the extra keys. */
export function listDeps(search: ListSearch) {
	return {
		search: search.search,
		sortBy: search.sortBy,
		sortOrder: search.sortOrder,
		page: search.page,
		perPage: search.perPage,
	};
}

/** Normalizes the table params the way every old table page did. */
export function parseListSearch(search: ListSearch) {
	const perPage = String(search.perPage ?? "");
	return {
		currentPage: Math.max(1, Number(search.page || 1)),
		pageSize: perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25,
		search: search.search ? String(search.search) : undefined,
		sortBy: search.sortBy ? String(search.sortBy) : undefined,
		sortOrder: search.sortOrder === "asc" ? ("asc" as const) : ("desc" as const),
	};
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** `T` with every `unknown` replaced by `JsonValue`, so the router accepts it as loader data. */
export type Wire<T> = unknown extends T
	? JsonValue
	: T extends readonly (infer U)[]
		? Wire<U>[]
		: T extends object
			? { [K in keyof T]: Wire<T[K]> }
			: T;

/** The API only returns JSON, but its generated types use `unknown` for free-form fields. */
export function asWire<T>(value: T): Wire<T> {
	return value as Wire<T>;
}
