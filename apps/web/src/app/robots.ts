import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
	const isBeta = env.NEXT_PUBLIC_BETA || env.NEXT_PUBLIC_WEB_URL.includes("beta.");

	if (isBeta) {
		return {
			rules: { userAgent: "*", disallow: "/" },
		};
	}

	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/api/", "/dashboard/"],
		},
		sitemap: `${env.NEXT_PUBLIC_WEB_URL}/sitemap.xml`,
	};
}
