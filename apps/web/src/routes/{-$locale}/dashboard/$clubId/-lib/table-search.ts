import * as z from "zod";

// The router parses `?search=123` as a number, so every value is coerced back to a string.
const text = z.coerce.string().optional();

export const tableSearchSchema = z.object({
	search: text,
	sortBy: text,
	sortOrder: text,
	page: text,
	perPage: text,
	role: text,
	status: text,
	actionType: text,
});

export type TableSearch = z.infer<typeof tableSearchSchema>;

export function parsePaging(page: string | undefined, perPage: string | undefined) {
	return {
		currentPage: Math.max(1, Number(page || 1)),
		pageSize: perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25,
	};
}
