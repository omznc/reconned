import { env } from "@/lib/env";

export function GET() {
	const isBeta = env.NEXT_PUBLIC_BETA || env.NEXT_PUBLIC_WEB_URL.includes("beta.");

	if (isBeta) {
		const body = ["User-agent: *", "Disallow: /", "Content-Signal: ai-train=no, search=no, ai-input=no"].join("\n");
		return new Response(body, {
			headers: {
				"content-type": "text/plain; charset=utf-8",
			},
		});
	}

	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/",
		"Disallow: /dashboard/",
		"Content-Signal: ai-train=no, search=yes, ai-input=yes",
		`Sitemap: ${env.NEXT_PUBLIC_WEB_URL}/sitemap.xml`,
	].join("\n");

	return new Response(body, {
		headers: {
			"content-type": "text/plain; charset=utf-8",
		},
	});
}
