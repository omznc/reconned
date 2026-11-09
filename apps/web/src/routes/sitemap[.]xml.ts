import { createFileRoute } from "@tanstack/react-router";
import { buildSitemapEntries, renderSitemapXml } from "@/lib/server/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () =>
				new Response(renderSitemapXml(await buildSitemapEntries()), {
					headers: { "content-type": "application/xml" },
				}),
		},
	},
});
