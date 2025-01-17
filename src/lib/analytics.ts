import "server-only";
import { env } from "@/lib/env";

type TimeseriesResponse = {
	results: Array<{
		date: string;
		visitors: number;
		pageviews: number;
	}>;
};

type AggregateResponse = {
	results: {
		visitors: {
			value: number;
		};
		pageviews: number;
		bounce_rate: number;
		visit_duration: number;
	};
};

type TimePeriod = "30d" | "7d" | "month" | "6mo" | "12mo" | "custom";

type PagesResponse = {
	results: Array<{
		page: string;
		visitors: number;
		pageviews: number;
		bounce_rate: number;
		visit_duration: number;
	}>;
};

/**
 * Fetch aggregate analytics for a specific page path.
 */
export async function getPageViews(
	path: string,
	period: TimePeriod = "30d",
): Promise<AggregateResponse> {
	const url = `${env.PLAUSIBLE_HOST}/api/v1/stats/aggregate?site_id=${
		env.PLAUSIBLE_SITE_ID
	}&period=${period}&filters=event:page==${encodeURIComponent(path)}`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch Plausible analytics: ${response.statusText}`,
		);
	}

	const data = await response.json();
	return data as AggregateResponse;
}

/**
 * Fetch historical timeseries data for analytics
 */
export async function getHistoricalPageViews(
	path: string,
	period: TimePeriod = "30d",
): Promise<TimeseriesResponse> {
	const url = `${env.PLAUSIBLE_HOST}/api/v1/stats/timeseries?site_id=${
		env.PLAUSIBLE_SITE_ID
	}&period=${period}&filters=event:page==${encodeURIComponent(path)}`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch Plausible analytics: ${response.statusText}`,
		);
	}

	const data = await response.json();
	return data;
}

/**
 * Get analytics for a user's profile page
 */
export async function getUserAnalytics(
	userId: string,
	period: TimePeriod = "30d",
) {
	return getPageViews(`/users/${userId}`, period);
}

/**
 * Get analytics for a club's page
 */
export async function getClubAnalytics(
	clubId: string,
	period: TimePeriod = "30d",
) {
	return getPageViews(`/clubs/${clubId}`, period);
}

/**
 * Get analytics for an event page
 */
export async function getEventAnalytics(
	eventId: string,
	period: TimePeriod = "30d",
) {
	return getPageViews(`/events/${eventId}`, period);
}

/**
 * Get historical analytics for any entity (user/club/event)
 */
export async function getEntityHistoricalAnalytics(
	entityType: "users" | "clubs" | "events",
	entityId: string,
	period: TimePeriod = "30d",
) {
	return getHistoricalPageViews(`/${entityType}/${entityId}`, period);
}

/**
 * Fetch top pages matching a path pattern
 */
async function getTopPages(
	pathPattern: string,
	limit: number,
	period: TimePeriod = "30d",
): Promise<PagesResponse> {
	const url = `${env.PLAUSIBLE_HOST}/api/v1/stats/pages?site_id=${
		env.PLAUSIBLE_SITE_ID
	}&period=${period}&filters=event:page=~${encodeURIComponent(
		pathPattern,
	)}&limit=${limit}`;

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
		},
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch Plausible analytics: ${response.statusText}`,
		);
	}

	return response.json();
}

/**
 * Extract entity ID from a path
 */
function extractIdFromPath(path: string): string {
	return path.split("/").pop() || "";
}

/**
 * Get top N users by pageviews
 */
export async function getTopUsersByViews(
	limit: number,
	period: TimePeriod = "30d",
): Promise<Array<{ id: string; views: number }>> {
	const data = await getTopPages("/users/", limit, period);
	return data.results.map((result) => ({
		id: extractIdFromPath(result.page),
		views: result.pageviews,
	}));
}

/**
 * Get top N clubs by pageviews
 */
export async function getTopClubsByViews(
	limit: number,
	period: TimePeriod = "30d",
): Promise<Array<{ id: string; views: number }>> {
	const data = await getTopPages("/clubs/", limit, period);
	return data.results.map((result) => ({
		id: extractIdFromPath(result.page),
		views: result.pageviews,
	}));
}

/**
 * Get top N events by pageviews
 */
export async function getTopEventsByViews(
	limit: number,
	period: TimePeriod = "30d",
): Promise<Array<{ id: string; views: number }>> {
	const data = await getTopPages("/events/", limit, period);
	return data.results.map((result) => ({
		id: extractIdFromPath(result.page),
		views: result.pageviews,
	}));
}
