import { env } from "@/lib/env";

function normalizeApiBase(url: string): string {
	const trimmed = url.replace(/\/+$/, "");
	if (trimmed.endsWith("/api")) {
		return trimmed;
	}
	return `${trimmed}/api`;
}

export function GET() {
	const apiBase = normalizeApiBase(env.NEXT_PUBLIC_BACKEND_URL);
	const body = {
		linkset: [
			{
				anchor: apiBase,
				"service-desc": [
					{
						href: `${apiBase}/openapi.json`,
						type: "application/openapi+json",
					},
				],
				"service-doc": [
					{
						href: `${apiBase}/docs`,
						type: "text/html",
					},
				],
				status: [
					{
						href: `${apiBase}/health`,
						type: "application/json",
					},
				],
			},
		],
	};

	return new Response(JSON.stringify(body), {
		headers: {
			"cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
			"content-type": "application/linkset+json; charset=utf-8",
		},
	});
}
