import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import type { EventRowState } from "@/components/redesign/event-row";
import { toDate } from "@/components/redesign/format-event-date";

export const SEARCH_TABS = ["all", "events", "clubs", "players"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

const searchParsers = {
	q: parseAsString.withDefault(""),
	tab: parseAsStringLiteral(SEARCH_TABS).withDefault("all"),
	country: parseAsInteger,
	upcoming: parseAsBoolean.withDefault(false),
	open: parseAsBoolean.withDefault(false),
	verified: parseAsBoolean.withDefault(false),
};

export type SearchParams = {
	q: string;
	tab: SearchTab;
	country: number | null;
	upcoming: boolean;
	open: boolean;
	verified: boolean;
};

export function useSearchParams() {
	return useQueryStates(searchParsers, { clearOnDefault: true });
}

/** The URL of the search page with the given state. The link keeps the refine filters. */
export function searchHref(params: SearchParams, patch: Partial<SearchParams>): string {
	const next = { ...params, ...patch };
	const url = new URLSearchParams();
	if (next.q) {
		url.set("q", next.q);
	}
	if (next.tab !== "all") {
		url.set("tab", next.tab);
	}
	if (next.country !== null) {
		url.set("country", String(next.country));
	}
	for (const key of ["upcoming", "open", "verified"] as const) {
		if (next[key]) {
			url.set(key, "true");
		}
	}
	const query = url.toString();
	return query ? `/search?${query}` : "/search";
}

/** The query of the refine filters for the backend. Only set filters go in. */
export function refineQuery(params: SearchParams) {
	return {
		...(params.country === null ? {} : { countryId: params.country }),
		...(params.upcoming ? { upcomingOnly: "true" as const } : {}),
		...(params.open ? { registrationOpen: "true" as const } : {}),
		...(params.verified ? { verifiedOnly: "true" as const } : {}),
	};
}

const CLOSING_SOON_MS = 48 * 60 * 60 * 1000;

interface EventDates {
	dateRegistrationsOpen?: string;
	dateRegistrationsClose?: string;
	placesLeft: number | null;
}

/** The search items do not carry the registration state, so derive it from the dates. */
export function eventState(event: EventDates, now = new Date()): EventRowState {
	if (event.placesLeft === 0) {
		return "full";
	}
	const opens = event.dateRegistrationsOpen ? toDate(event.dateRegistrationsOpen) : null;
	const closes = event.dateRegistrationsClose ? toDate(event.dateRegistrationsClose) : null;
	if (opens && opens > now) {
		return "pending";
	}
	if (closes && closes < now) {
		return "closed";
	}
	if (closes && closes.getTime() - now.getTime() < CLOSING_SOON_MS) {
		return "closing";
	}
	return "open";
}

const RECENT_KEY = "reconned:recent-searches";
const RECENT_MAX = 5;

function readRecent(): string[] {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
}

/** Recent query texts. They live only in this browser. */
export function useRecentSearches() {
	const [recent, setRecent] = useState<string[]>([]);

	useEffect(() => {
		setRecent(readRecent());
	}, []);

	const add = useCallback((query: string) => {
		const text = query.trim();
		if (!text) {
			return;
		}
		const next = [text, ...readRecent().filter((item) => item !== text)].slice(0, RECENT_MAX);
		localStorage.setItem(RECENT_KEY, JSON.stringify(next));
		setRecent(next);
	}, []);

	const clear = useCallback(() => {
		localStorage.removeItem(RECENT_KEY);
		setRecent([]);
	}, []);

	return { recent, add, clear };
}
