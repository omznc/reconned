import { DEFAULT_TIME_ZONE } from "@/i18n/routing";

type DateInput = string | Date;

/** The API sends `"2026-11-16 22:07:57.963"` with no zone marker. It means UTC. */
export function toDate(value: DateInput): Date {
	if (value instanceof Date) {
		return value;
	}
	const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
	return new Date(hasZone ? value : `${value.replace(" ", "T")}Z`);
}

export function formatDateParts(value: DateInput, locale: string) {
	const date = toDate(value);
	const part = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale, { timeZone: DEFAULT_TIME_ZONE, ...options }).format(date);
	return {
		weekday: part({ weekday: "short" }),
		day: part({ day: "2-digit" }),
		month: part({ month: "short" }),
	};
}

export function formatTime(value: DateInput, locale: string) {
	return new Intl.DateTimeFormat(locale, {
		timeZone: DEFAULT_TIME_ZONE,
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(toDate(value));
}

export function formatTimeRange(start: DateInput, end: DateInput | null | undefined, locale: string) {
	const from = formatTime(start, locale);
	return end ? `${from} – ${formatTime(end, locale)}` : from;
}

/** Share of the places that are taken, from 0 to 1. */
export function takenShare(placesLeft: number, maxAttendees: number) {
	if (maxAttendees <= 0) {
		return 0;
	}
	return Math.min(1, Math.max(0, (maxAttendees - placesLeft) / maxAttendees));
}

export const HOT_SHARE = 0.9;
