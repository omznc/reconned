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
		// remotePatterns: [
		// 	{
		// 		protocol: "https",
		// 		hostname: "s3-airsoft.omarzunic.com",
		// 	},
		// 	{
		// 		protocol: "https",
		// 		hostname: "cdn.reconned.com",
		// 	},
		// 	{
		// 		protocol: "https",
		// 		hostname: "cdn-beta.reconned.com",
		// 	},
		// 	{
		// 		protocol: "https",
		// 		hostname: "lh3.googleusercontent.com",
		// 	},
		// 	{
		// 		protocol: "https",
		// 		hostname: "i.imgur.com",
		// 	},
		// 	{
		// 		protocol: "https",
		// 		hostname: "*.cdninstagram.com",
		// 	},
		// 	{
		// 		protocol: "https",
		// 		hostname: "*.fbcdn.net",
		// 	},
		// ],
		loader: 'custom',
		loaderFile: './image-loader.ts',
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
		];
	},
} as NextConfig;

export default withAxiom(withNextIntl(nextConfig));
