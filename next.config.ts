import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const withNextIntl = createNextIntlPlugin({
	experimental: {
		createMessagesDeclaration: "./messages/en.json",
	},
});

process.env.NEXT_PUBLIC_AXIOM_DATASET = env.NEXT_PUBLIC_AXIOM_DATASET;
process.env.NEXT_PUBLIC_AXIOM_TOKEN = env.NEXT_PUBLIC_AXIOM_TOKEN;

const localesString = routing.locales.map((locale) => `${locale}`).join("|");

const nextConfig = {
	output: "standalone",
	reactStrictMode: true,
	typedRoutes: true,
	reactCompiler: true,
	experimental: {
		staleTimes: {
			staleTimes: {
				dynamic: 30,
				static: 180,
			},
		},
		webpackMemoryOptimizations: true,
		viewTransition: true,
		serverComponentsHmrCache: true,
	},
	images: {
		// remotePatterns: [ ... ],
		loader: "custom",
		loaderFile: "./image-loader.ts",
		qualities: [50, 75, 100],
	},
	async redirects() {
		return [
			{
				source: `/:locale(${localesString})/u/:path*`,
				destination: "/:locale/users/:path*",
				permanent: true,
			},
			{
				source: `/:locale(${localesString})/e/:path*`,
				destination: "/:locale/events/:path*",
				permanent: true,
			},
			{
				source: `/:locale(${localesString})/c/:path*`,
				destination: "/:locale/clubs/:path*",
				permanent: true,
			},
			{
				source: `/:locale(${localesString})/stats`,
				destination: "https://scout.reconned.com/share/reconned.com?auth=Z_HrtmMkcNRQ1zcVm4iky",
				permanent: true,
			},
			{
				source: `/:locale(${localesString})/ingest/static/:path*`,
				destination: "https://eu-assets.i.posthog.com/static/:path*",
			},
			{
				source: `/:locale(${localesString})/ingest/:path*`,
				destination: "https://eu.i.posthog.com/:path*",
			},
		];
	},
	skipTrailingSlashRedirect: true,
} as NextConfig;

export default withAxiom(withNextIntl(nextConfig));
