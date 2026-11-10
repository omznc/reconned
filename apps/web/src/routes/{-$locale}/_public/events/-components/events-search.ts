import { debounce, parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";
import * as z from "zod";

export const PER_PAGE = 12;
export const MAX_PER_PAGE = 100;
export const PRICE_SLIDER_MAX = 100;

export const REGISTRATION_STATES = ["open", "notOpenYet", "full", "closed"] as const;
export type RegistrationFilter = (typeof REGISTRATION_STATES)[number];
export const SORTS = ["soonest", "placesLeft", "price"] as const;
export type EventsSort = (typeof SORTS)[number];
export const WHEN_VALUES = ["weekend", "next30"] as const;
export const VIEWS = ["list", "calendar"] as const;

/** The router parses `?page=2` to a number, so every value is turned back to text. */
const text = z.union([z.string(), z.number(), z.boolean()]).transform(String).optional().catch(undefined);

export const eventsSearchSchema = z.looseObject({
	view: text,
	month: text,
	q: text,
	sort: text,
	when: text,
	from: text,
	to: text,
	reg: text,
	country: text,
	city: text,
	maxPrice: text,
	freelancers: text,
	verified: text,
	page: text,
});

export interface EventsQuery {
	view: (typeof VIEWS)[number];
	month?: string;
	page: number;
	search?: string;
	sort: EventsSort;
	when?: (typeof WHEN_VALUES)[number];
	dateFrom?: string;
	dateTo?: string;
	registration: RegistrationFilter[];
	countryId: number[];
	city?: string;
	maxPrice?: number;
	freelancers: boolean;
	verifiedOnly: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

function matching(pattern: RegExp, value: string | undefined) {
	return value && pattern.test(value) ? value : undefined;
}

function pick<T extends string>(values: readonly T[], value: string | undefined): T | undefined {
	return values.find((candidate) => candidate === value);
}

function list(value: string | undefined) {
	return value ? value.split(",").filter(Boolean) : [];
}

function whole(value: string | undefined) {
	const parsed = Number.parseInt(value ?? "", 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Turns the raw URL search into a clean query. A bad value falls back to its default. */
export function toEventsQuery(search: z.infer<typeof eventsSearchSchema>): EventsQuery {
	return {
		view: pick(VIEWS, search.view) ?? "list",
		month: matching(MONTH, search.month),
		page: Math.max(1, whole(search.page) ?? 1),
		search: search.q?.trim().slice(0, 100) || undefined,
		sort: pick(SORTS, search.sort) ?? "soonest",
		when: pick(WHEN_VALUES, search.when),
		dateFrom: matching(DAY, search.from),
		dateTo: matching(DAY, search.to),
		registration: list(search.reg).filter((value): value is RegistrationFilter =>
			REGISTRATION_STATES.some((state) => state === value),
		),
		countryId: list(search.country)
			.map((value) => Number.parseInt(value, 10))
			.filter(Number.isFinite),
		city: search.city?.trim().slice(0, 100) || undefined,
		maxPrice: whole(search.maxPrice),
		freelancers: search.freelancers === "true",
		verifiedOnly: search.verified === "true",
	};
}

/** The backend sort params for one sort option. */
export function sortParams(sort: EventsSort) {
	if (sort === "placesLeft") {
		return { sortBy: "placesLeft", sortOrder: "desc" } as const;
	}
	return { sortBy: sort === "price" ? "price" : "dateStart", sortOrder: "asc" } as const;
}

/** Page N of "Load more" means: show the first N * PER_PAGE events. */
export function perPageFor(page: number) {
	return Math.min(MAX_PER_PAGE, page * PER_PAGE);
}

/** Every change of a filter writes the URL and runs the loader again. */
const urlOptions = { shallow: false, history: "push", clearOnDefault: true } as const;

export const eventsParsers = {
	view: parseAsStringLiteral(VIEWS).withDefault("list").withOptions(urlOptions),
	q: parseAsString.withDefault("").withOptions({ ...urlOptions, history: "replace", limitUrlUpdates: debounce(300) }),
	sort: parseAsStringLiteral(SORTS).withDefault("soonest").withOptions(urlOptions),
	when: parseAsStringLiteral(WHEN_VALUES).withOptions(urlOptions),
	from: parseAsString.withOptions(urlOptions),
	to: parseAsString.withOptions(urlOptions),
	reg: parseAsArrayOf(parseAsStringLiteral(REGISTRATION_STATES)).withDefault([]).withOptions(urlOptions),
	country: parseAsArrayOf(parseAsInteger).withDefault([]).withOptions(urlOptions),
	city: parseAsString
		.withDefault("")
		.withOptions({ ...urlOptions, history: "replace", limitUrlUpdates: debounce(400) }),
	maxPrice: parseAsInteger.withOptions(urlOptions),
	freelancers: parseAsBoolean.withDefault(false).withOptions(urlOptions),
	verified: parseAsBoolean.withDefault(false).withOptions(urlOptions),
	page: parseAsInteger.withDefault(1).withOptions(urlOptions),
};
