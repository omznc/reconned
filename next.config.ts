import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin({
	experimental: {
		createMessagesDeclaration: "./messages/en.json",
	},
});
import { withSentryConfig } from "@sentry/nextjs";
import { routing } from "@/i18n/routing";

const localesString = routing.locales.map((locale) => `${locale}`).join("|");

const nextConfig = {
	reactStrictMode: true,
	experimental: {
		reactCompiler: true,
		staleTimes: {
			staleTimes: {
				dynamic: 30,
				static: 180,
			},
		},
		webpackMemoryOptimizations: true,
		viewTransition: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "s3-airsoft.omarzunic.com",
			},
			{
				protocol: "https",
				hostname: "cdn.reconned.com",
			},
			{
				protocol: "https",
				hostname: "cdn-beta.reconned.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "i.imgur.com",
			},
			{
				protocol: "https",
				hostname: "*.cdninstagram.com",
			},
			{
				protocol: "https",
				hostname: "*.fbcdn.net",
			},
		],
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
				destination:
					"https://scout.reconned.com/share/reconned.com?auth=Z_HrtmMkcNRQ1zcVm4iky",
				permanent: true,
			},
		];
	},
} as NextConfig;

export default withSentryConfig(withNextIntl(nextConfig));
