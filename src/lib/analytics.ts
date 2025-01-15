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
	console.log(data);
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
