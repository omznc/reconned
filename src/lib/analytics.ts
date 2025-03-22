import "server-only";
import { env } from "@/lib/env";
import { routing } from "@/i18n/routing";

const locales = routing.locales;

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
 * Generate all possible paths for a given endpoint (legacy + localized paths)
 */
function getAllPossiblePaths(path: string): string[] {
	// Include the legacy path without locale prefix
	const paths = [path];

	// Add localized paths
	for (const locale of locales) {
		paths.push(`/${locale}${path}`);
	}

	return paths;
}

/**
 * Fetch aggregate analytics for a specific page path.
 * Combines data from legacy path and all localized paths.
 */
export async function getPageViews(
	path: string,
	period: TimePeriod = "30d",
): Promise<AggregateResponse> {
	const paths = getAllPossiblePaths(path);

	const results = await Promise.all(
		paths.map(async (p) => {
			const url = `${env.PLAUSIBLE_HOST}/api/v1/stats/aggregate?site_id=${
				env.PLAUSIBLE_SITE_ID
			}&period=${period}&filters=event:page==${encodeURIComponent(p)}`;

			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
				},
			});

			if (!response.ok) {
				// Return empty result if this specific path fails
				return {
					results: {
						visitors: { value: 0 },
						pageviews: 0,
						bounce_rate: 0,
						visit_duration: 0,
					},
				} as AggregateResponse;
			}

			return response.json() as Promise<AggregateResponse>;
		}),
	);

	// Combine results
	const combined: AggregateResponse = {
		results: {
			visitors: { value: 0 },
			pageviews: 0,
			bounce_rate: 0,
			visit_duration: 0,
		},
	};

	let totalPageviews = 0;
	let totalVisitors = 0;
	let weightedBounceRate = 0;
	let weightedVisitDuration = 0;

	for (const result of results) {
		totalPageviews += result.results.pageviews;
		totalVisitors += result.results.visitors.value;

		// Weight metrics by visitor count
		if (result.results.visitors.value > 0) {
			weightedBounceRate +=
				result.results.bounce_rate * result.results.visitors.value;
			weightedVisitDuration +=
				result.results.visit_duration * result.results.visitors.value;
		}
	}

	combined.results.pageviews = totalPageviews;
	combined.results.visitors.value = totalVisitors;

	// Calculate weighted averages
	if (totalVisitors > 0) {
		combined.results.bounce_rate = weightedBounceRate / totalVisitors;
		combined.results.visit_duration = weightedVisitDuration / totalVisitors;
	}

	return combined;
}

/**
 * Fetch historical timeseries data for analytics
 * Combines data from legacy path and all localized paths
 */
export async function getHistoricalPageViews(
	path: string,
	period: TimePeriod = "30d",
): Promise<TimeseriesResponse> {
	const paths = getAllPossiblePaths(path);

	const results = await Promise.all(
		paths.map(async (p) => {
			const url = `${env.PLAUSIBLE_HOST}/api/v1/stats/timeseries?site_id=${
				env.PLAUSIBLE_SITE_ID
			}&period=${period}&filters=event:page==${encodeURIComponent(p)}`;

			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
				},
			});

			if (!response.ok) {
				// Return empty result if this specific path fails
				return { results: [] } as TimeseriesResponse;
			}

			return response.json() as Promise<TimeseriesResponse>;
		}),
	);

	// Combine timeseries data by date
	const dateMap = new Map<string, { visitors: number; pageviews: number }>();

	for (const result of results) {
		for (const entry of result.results) {
			const existingData = dateMap.get(entry.date) || {
				visitors: 0,
				pageviews: 0,
			};
			dateMap.set(entry.date, {
				visitors: existingData.visitors + entry.visitors,
				pageviews: existingData.pageviews + entry.pageviews,
			});
		}
	}

	// Convert map back to array and sort by date
	const combined: TimeseriesResponse = {
		results: Array.from(dateMap.entries())
			.map(([date, data]) => ({
				date,
				visitors: data.visitors,
				pageviews: data.pageviews,
			}))
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
	};

	return combined;
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
 * Combines data from legacy and localized paths
 */
async function getTopPages(
	pathPattern: string,
	limit: number,
	period: TimePeriod = "30d",
): Promise<PagesResponse> {
	// Generate all possible path patterns
	const patterns = getAllPossiblePaths(pathPattern);
	const allResults: Array<{
		page: string;
		visitors: number;
		pageviews: number;
		bounce_rate: number;
		visit_duration: number;
	}> = [];

	// Fetch data for each pattern
	for (const pattern of patterns) {
		const url = `${env.PLAUSIBLE_HOST}/api/v1/stats/pages?site_id=${
			env.PLAUSIBLE_SITE_ID
		}&period=${period}&filters=event:page=~${encodeURIComponent(
			pattern,
		)}&limit=${limit * 2}`; // Fetch more results to account for potential duplicates

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${env.PLAUSIBLE_API_KEY}`,
			},
		});

		if (response.ok) {
			const data = (await response.json()) as PagesResponse;
			allResults.push(...data.results);
		}
	}

	// Normalize paths to remove locale prefixes and combine metrics for the same entity
	const normalizedResults = new Map<
		string,
		{
			page: string;
			visitors: number;
			pageviews: number;
			bounce_rate: number;
			visit_duration: number;
			rawVisitorCount: number; // Used for weighted calculations
		}
	>();

	for (const result of allResults) {
		// Normalize the path to remove locale prefix
		const normalizedPath = normalizePath(result.page);
		const existing = normalizedResults.get(normalizedPath) || {
			page: normalizedPath,
			visitors: 0,
			pageviews: 0,
			bounce_rate: 0,
			visit_duration: 0,
			rawVisitorCount: 0,
		};

		// Update metrics
		existing.pageviews += result.pageviews;
		existing.visitors += result.visitors;
		existing.rawVisitorCount += result.visitors;

		// Weight metrics by visitor count
		if (result.visitors > 0) {
			existing.bounce_rate += result.bounce_rate * result.visitors;
			existing.visit_duration += result.visit_duration * result.visitors;
		}

		normalizedResults.set(normalizedPath, existing);
	}

	// Calculate final weighted metrics and prepare results
	const finalResults = Array.from(normalizedResults.values()).map((result) => {
		if (result.rawVisitorCount > 0) {
			result.bounce_rate = result.bounce_rate / result.rawVisitorCount;
			result.visit_duration = result.visit_duration / result.rawVisitorCount;
		}

		// Remove the temporary property
		const { rawVisitorCount, ...cleanResult } = result;
		return cleanResult;
	});

	// Sort by pageviews and limit results
	finalResults.sort((a, b) => b.pageviews - a.pageviews);

	return {
		results: finalResults.slice(0, limit),
	};
}

/**
 * Normalize a path by removing locale prefix if present
 */
function normalizePath(path: string): string {
	// Check if path has a locale prefix and remove it
	for (const locale of locales) {
		if (path.startsWith(`/${locale}/`)) {
			return path.substring(locale.length + 1);
		}
	}
	return path;
}

/**
 * Extract entity ID from a path, handling locale prefixes
 */
function extractIdFromPath(path: string): string {
	// Normalize path first to remove locale prefix if present
	const normalizedPath = normalizePath(path);
	return normalizedPath.split("/").pop() || "";
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
