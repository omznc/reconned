import { env } from "@/lib/env";

export function GET() {
	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/",
		"Disallow: /dashboard/",
		`Sitemap: ${env.NEXT_PUBLIC_WEB_URL}/sitemap.xml`,
	].join("\n");

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}
