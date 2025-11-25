import "server-only";

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

export async function getPageViews(_path: string, _period: TimePeriod = "30d"): Promise<AggregateResponse> {
	// TODO
	return {
		results: {
			visitors: {
				value: 0,
			},
			pageviews: 0,
			bounce_rate: 0,
			visit_duration: 0,
		},
	};
}
