import { env } from "@/lib/env";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const isBeta = env.NEXT_PUBLIC_BETTER_AUTH_URL?.includes("beta");

	return {
		rules: {
			userAgent: "*",
			allow: isBeta ? undefined : "/",
			disallow: isBeta ? "/" : "/api/",
		},
		sitemap: isBeta ? undefined : `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/sitemap.xml`,
	};
}
