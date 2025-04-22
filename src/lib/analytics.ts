import "server-only";
import { env } from "@/lib/env";
import { routing } from "@/i18n/routing";

const locales = routing.locales;

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
export async function getPageViews(path: string, period: TimePeriod = "30d"): Promise<AggregateResponse> {
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
			weightedBounceRate += result.results.bounce_rate * result.results.visitors.value;
			weightedVisitDuration += result.results.visit_duration * result.results.visitors.value;
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
