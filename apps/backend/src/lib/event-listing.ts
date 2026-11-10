import { apiError } from "@reconned/router";
import { and, count, eq, gte, ilike, inArray, lt, lte, or, type SQL, sql } from "drizzle-orm";
import * as z from "zod";
import { club, country, event, eventAttendee } from "../drizzle/schema";
import { db } from "./db";
import { escapeLike } from "./like";

export const REGISTRATION_STATES = ["open", "notOpenYet", "closed", "full"] as const;
export type RegistrationState = (typeof REGISTRATION_STATES)[number];

/** Events have no currency column. The club's country decides it; this is the fallback. */
export const DEFAULT_CURRENCY = "BAM";

export const SARAJEVO_TZ = "Europe/Sarajevo";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The fields every event list item carries on top of the event row. */
export const eventListExtrasSchema = z.object({
	attendeeCount: z.number(),
	capacity: z.number().nullable(),
	placesLeft: z.number().nullable(),
	registrationState: z.enum(REGISTRATION_STATES),
	price: z.number(),
	currency: z.string(),
});

/** DB timestamps carry no zone marker and are stored as UTC. `new Date()` would read them as local time. */
export function parseDbTimestamp(value: string): Date {
	const hasZone = /(?:z|[+-]\d{2}(?::?\d{2})?)$/i.test(value);
	return new Date(hasZone ? value : `${value.replace(" ", "T")}Z`);
}

/**
 * Registration state of an event. Same rule as the SQL in `registrationStateSql`.
 * The apply route rejects `open > now` and `close < now`, so both ends are inclusive.
 */
export function registrationStateOf(
	e: { dateRegistrationsOpen: string; dateRegistrationsClose: string; maxAttendees: number | null },
	attendeeCount: number,
	now: Date,
): RegistrationState {
	if (now < parseDbTimestamp(e.dateRegistrationsOpen)) {
		return "notOpenYet";
	}
	if (now > parseDbTimestamp(e.dateRegistrationsClose)) {
		return "closed";
	}
	if (e.maxAttendees !== null && attendeeCount >= e.maxAttendees) {
		return "full";
	}
	return "open";
}

export function listItemExtras(
	e: {
		dateRegistrationsOpen: string;
		dateRegistrationsClose: string;
		maxAttendees: number | null;
		costPerPerson: number;
	},
	attendeeCount: number,
	currencyCode: string | null,
	now: Date,
) {
	return {
		attendeeCount,
		capacity: e.maxAttendees,
		placesLeft: e.maxAttendees === null ? null : Math.max(0, e.maxAttendees - attendeeCount),
		registrationState: registrationStateOf(e, attendeeCount, now),
		price: e.costPerPerson,
		currency: currencyCode ?? DEFAULT_CURRENCY,
	};
}

/** Confirmed people per event, for a page of events. One grouped query. */
export async function getAttendeeCounts(eventIds: string[]): Promise<Map<string, number>> {
	if (eventIds.length === 0) {
		return new Map();
	}
	const rows = await db
		.select({ eventId: eventAttendee.eventId, value: count() })
		.from(eventAttendee)
		.where(and(inArray(eventAttendee.eventId, eventIds), eq(eventAttendee.status, "CONFIRMED")))
		.groupBy(eventAttendee.eventId);
	return new Map(rows.map((r) => [r.eventId, Number(r.value)]));
}

/** SQL twin of `registrationStateOf`. `attendeeCount` is an SQL expression. */
export function registrationStateSql(attendeeCount: SQL, now: Date): SQL<RegistrationState> {
	// Inlined, not bound: GROUP BY must match the select expression, and two bound parameters never match.
	// Safe: `toISOString()` output has only digits, "-", ":", ".", "T" and "Z".
	const nowLiteral = sql.raw(`'${now.toISOString()}'::timestamp`);
	return sql<RegistrationState>`CASE
		WHEN ${nowLiteral} < ${event.dateRegistrationsOpen} THEN 'notOpenYet'
		WHEN ${nowLiteral} > ${event.dateRegistrationsClose} THEN 'closed'
		WHEN ${event.maxAttendees} IS NOT NULL AND ${attendeeCount} >= ${event.maxAttendees} THEN 'full'
		ELSE 'open' END`;
}

export function placesLeftSql(attendeeCount: SQL): SQL<number | null> {
	return sql<
		number | null
	>`CASE WHEN ${event.maxAttendees} IS NULL THEN NULL ELSE GREATEST(${event.maxAttendees} - ${attendeeCount}, 0) END`;
}

// ---- Time ranges, in Europe/Sarajevo time ----

function zoneParts(date: Date) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: SARAJEVO_TZ,
		hourCycle: "h23",
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		weekday: "short",
	}).formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	return {
		year: Number(get("year")),
		month: Number(get("month")),
		day: Number(get("day")),
		hour: Number(get("hour")),
		minute: Number(get("minute")),
		second: Number(get("second")),
		// Monday = 1 ... Sunday = 7
		weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1,
	};
}

function zoneOffsetMs(date: Date): number {
	const p = zoneParts(date);
	const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
	return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant of 00:00 Sarajevo time on a calendar day. `day` may overflow the month. */
export function sarajevoMidnight(year: number, month: number, day: number): Date {
	const guess = Date.UTC(year, month - 1, day);
	// Two passes cover a DST change between the guess and the real instant.
	const first = guess - zoneOffsetMs(new Date(guess));
	return new Date(guess - zoneOffsetMs(new Date(first)));
}

/** Saturday 00:00 to Monday 00:00 (exclusive) of the current weekend. On Sunday it is the weekend that began yesterday. */
export function weekendRange(now: Date): { from: Date; to: Date } {
	const p = zoneParts(now);
	const toSaturday = 6 - p.weekday;
	return {
		from: sarajevoMidnight(p.year, p.month, p.day + toSaturday),
		to: sarajevoMidnight(p.year, p.month, p.day + toSaturday + 2),
	};
}

export function next30Range(now: Date): { from: Date; to: Date } {
	return { from: now, to: new Date(now.getTime() + 30 * DAY_MS) };
}

/** `YYYY-MM-DD` as a Sarajevo calendar day. */
function sarajevoDay(value: string, plusDays = 0): Date {
	const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
	return sarajevoMidnight(year, month, day + plusDays);
}

// ---- Filters ----

export interface EventFilterInput {
	dateFrom?: string;
	dateTo?: string;
	when?: "weekend" | "next30";
	registration?: RegistrationState[];
	countryId?: number[];
	city?: string;
	maxPrice?: number;
	freelancers?: boolean;
	verifiedOnly?: boolean;
}

export interface EventFilterConditions {
	registration: SQL | undefined;
	country: SQL | undefined;
	/** Everything else. These apply to every facet group. */
	rest: SQL[];
}

function dateConditions(input: EventFilterInput, now: Date): SQL[] {
	const conditions: SQL[] = [];
	if (input.dateFrom) {
		conditions.push(gte(event.dateStart, sarajevoDay(input.dateFrom).toISOString()));
	}
	if (input.dateTo) {
		// dateTo is a whole day, so the bound is the start of the next day.
		conditions.push(lt(event.dateStart, sarajevoDay(input.dateTo, 1).toISOString()));
	}
	if (input.when) {
		const range = input.when === "weekend" ? weekendRange(now) : next30Range(now);
		conditions.push(gte(event.dateStart, range.from.toISOString()), lt(event.dateStart, range.to.toISOString()));
	}
	return conditions;
}

function attributeConditions(input: EventFilterInput): SQL[] {
	const conditions: SQL[] = [];
	if (input.city) {
		conditions.push(
			or(ilike(club.city, escapeLike(input.city)), ilike(event.location, `%${escapeLike(input.city)}%`)) as SQL,
		);
	}
	if (input.maxPrice !== undefined) {
		conditions.push(lte(event.costPerPerson, input.maxPrice));
	}
	if (input.freelancers) {
		conditions.push(eq(event.allowFreelancers, true));
	}
	if (input.verifiedOnly) {
		conditions.push(eq(club.verified, true));
	}
	return conditions;
}

/** Split in groups so a facet can leave out its own group. `attendeeCount` is an SQL expression. */
export function eventFilterConditions(input: EventFilterInput, now: Date, attendeeCount: SQL): EventFilterConditions {
	return {
		registration: input.registration?.length
			? inArray(registrationStateSql(attendeeCount, now), input.registration)
			: undefined,
		country: input.countryId?.length ? inArray(club.countryId, input.countryId) : undefined,
		rest: [...dateConditions(input, now), ...attributeConditions(input)],
	};
}

// ---- Attendee counts inside a list query ----

/**
 * Confirmed people per event, limited to the events the caller can see. Without the inner filter
 * this would aggregate every attendee row on every page view.
 * One row per person, so a team of five counts as five.
 */
export function visibleAttendeeCounts(visibleWhere: SQL | undefined) {
	const visibleEventIds = db.select({ id: event.id }).from(event).where(visibleWhere);
	const subquery = db
		.select({
			eventId: eventAttendee.eventId,
			attendeeCount: count(eventAttendee.id).as("attendeeCount"),
		})
		.from(eventAttendee)
		.where(and(inArray(eventAttendee.eventId, visibleEventIds), eq(eventAttendee.status, "CONFIRMED")))
		.groupBy(eventAttendee.eventId)
		.as("attendeeCounts");
	return { subquery, countSql: sql`COALESCE(${subquery.attendeeCount}, 0)` };
}

export type VisibleAttendeeCounts = ReturnType<typeof visibleAttendeeCounts>;

export function listOrderBy(
	sortBy: string | undefined,
	sortOrder: string | undefined,
	attendeeCount: SQL,
	placesLeft: SQL,
): SQL[] {
	if (!sortBy) {
		// The original order: verified clubs first, then the busiest events.
		return [sql`${club.verified} DESC`, sql`${attendeeCount} DESC`, sql`${event.name} ASC`];
	}
	const dir = sortOrder === "desc" ? sql`DESC` : sql`ASC`;
	const tieBreak = [sql`${event.id} ASC`];
	if (sortBy === "name") {
		return [sql`${event.name} ${dir}`, ...tieBreak];
	}
	if (sortBy === "price") {
		return [sql`${event.costPerPerson} ${dir}`, sql`${event.dateStart} ASC`, ...tieBreak];
	}
	if (sortBy === "placesLeft") {
		// Unlimited events have no places left to compare, so they sort last in both directions.
		return [sql`${placesLeft} ${dir} NULLS LAST`, sql`${event.dateStart} ASC`, ...tieBreak];
	}
	return [sql`${event.dateStart} ${dir}`, sql`${event.name} ASC`, ...tieBreak];
}

// ---- Facets ----

export const eventFacetsSchema = z.object({
	registration: z.object({
		open: z.number(),
		notOpenYet: z.number(),
		closed: z.number(),
		full: z.number(),
	}),
	country: z.array(z.object({ countryId: z.number(), name: z.string(), count: z.number() })),
});

/**
 * Facet counts and the page header counts. Each facet group counts with every OTHER filter applied,
 * so ticking "Open" does not zero the other registration states. The header counts only use
 * visibility, never the filters.
 */
export async function buildEventFacets(args: {
	whereClause: SQL | undefined;
	filters: EventFilterConditions;
	attendees: VisibleAttendeeCounts;
	now: Date;
}) {
	const { whereClause, filters, attendees, now } = args;
	const { subquery, countSql } = attendees;
	const stateSql = registrationStateSql(countSql, now);
	const week = weekendRange(now);

	const [registrationRows, countryRows, headerRows] = await Promise.all([
		db
			.select({ state: stateSql, value: count() })
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.leftJoin(subquery, eq(event.id, subquery.eventId))
			.where(and(whereClause, filters.country, ...filters.rest))
			.groupBy(stateSql),
		db
			.select({ countryId: club.countryId, name: country.name, value: count() })
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.innerJoin(country, eq(club.countryId, country.id))
			.leftJoin(subquery, eq(event.id, subquery.eventId))
			.where(and(whereClause, filters.registration, ...filters.rest))
			.groupBy(club.countryId, country.name)
			.orderBy(sql`count(*) DESC`, country.name),
		db
			.select({
				upcoming: sql<number>`count(*) FILTER (WHERE ${event.dateStart} >= ${now.toISOString()})`.mapWith(
					Number,
				),
				weekendOpen:
					sql<number>`count(*) FILTER (WHERE ${event.dateStart} >= ${week.from.toISOString()} AND ${event.dateStart} < ${week.to.toISOString()} AND ${stateSql} = 'open')`.mapWith(
						Number,
					),
			})
			.from(event)
			.innerJoin(club, eq(event.clubId, club.id))
			.leftJoin(subquery, eq(event.id, subquery.eventId))
			.where(whereClause),
	]);

	const registration = { open: 0, notOpenYet: 0, closed: 0, full: 0 };
	for (const row of registrationRows) {
		registration[row.state] = Number(row.value);
	}

	return {
		facets: {
			registration,
			country: countryRows.map((r) => ({
				countryId: r.countryId as number,
				name: r.name,
				count: Number(r.value),
			})),
		},
		upcomingCount: headerRows[0]?.upcoming ?? 0,
		openThisWeekendCount: headerRows[0]?.weekendOpen ?? 0,
	};
}

// ---- Query parameter parsing ----

export const dateOnlySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export function parseEventFilters(query: {
	dateFrom?: string;
	dateTo?: string;
	when?: "weekend" | "next30";
	registration?: string;
	countryId?: string;
	city?: string;
	maxPrice?: number;
	freelancers?: string;
	verifiedOnly?: string;
}): EventFilterInput {
	return {
		dateFrom: query.dateFrom,
		dateTo: query.dateTo,
		when: query.when,
		registration: parseCsvEnum(query.registration, REGISTRATION_STATES),
		countryId: parseCsvInts(query.countryId),
		city: query.city?.trim() || undefined,
		maxPrice: query.maxPrice,
		freelancers: query.freelancers === "true",
		verifiedOnly: query.verifiedOnly === "true",
	};
}

// ---- Query parameter parsing helpers ----

export function parseCsvEnum<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] | undefined {
	if (!raw) {
		return undefined;
	}
	const values = raw
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
	const bad = values.find((v) => !(allowed as readonly string[]).includes(v));
	if (bad !== undefined) {
		throw apiError.validation(`Invalid value: ${bad}`);
	}
	return values as T[];
}

export function parseCsvInts(raw: string | undefined): number[] | undefined {
	if (!raw) {
		return undefined;
	}
	const values = raw.split(",").map((v) => Number(v.trim()));
	if (values.some((v) => !Number.isInteger(v))) {
		throw apiError.validation("Invalid integer list");
	}
	return values;
}
