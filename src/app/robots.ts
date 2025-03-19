import { env } from "@/lib/env";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const isBeta = env.NEXT_PUBLIC_BETTER_AUTH_URL?.includes("beta");

	return {
		rules: {
			userAgent: "*",
			...(isBeta ? { disallow: "/" } : { allow: "/", disallow: "/api/" }),
		},
		sitemap: `${env.NEXT_PUBLIC_BETTER_AUTH_URL}/sitemap.xml`,
	};
}
