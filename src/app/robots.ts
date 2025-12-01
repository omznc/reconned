import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: "/api/",
		},
		sitemap: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/sitemap.xml`,
	};
}
