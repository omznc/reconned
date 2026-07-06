import type { NextConfig } from "next";
import { withAxiom } from "next-axiom";
import createNextIntlPlugin from "next-intl/plugin";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const withNextIntl = createNextIntlPlugin({
	experimental: {
		srcPath: "./src",
		extract: true,
		messages: {
			sourceLocale: "en",
			path: "./messages",
			format: "json",
			locales: "infer",
		},
	},
});

process.env.NEXT_PUBLIC_AXIOM_DATASET = env.NEXT_PUBLIC_AXIOM_DATASET;
process.env.NEXT_PUBLIC_AXIOM_TOKEN = env.NEXT_PUBLIC_AXIOM_TOKEN;

const localesString = routing.locales.map((locale) => `${locale}`).join("|");

const nextConfig = {
	output: "standalone",
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	// typedRoutes: true, // Disabled - causes build errors with missing AppRouteHandlerRoutes
	reactCompiler: true,
	experimental: {
		staleTimes: {
			dynamic: 30,
			static: 180,
		},
		webpackMemoryOptimizations: true,
		viewTransition: true,
		serverComponentsHmrCache: true,
	},
	images: {
		loader: "custom",
		loaderFile: "./image-loader.ts",
		qualities: [50, 75, 100],
	},
	transpilePackages: ["backend"],
	async redirects() {
		return [
			{
				source: `/:locale(${localesString})/u/:path*`,
				destination: "/:locale/users/:path*",
				permanent: true,
			},
			{
				source: "/u/:path*",
				destination: "/users/:path*",
				permanent: true,
			},
			{
				source: `/:locale(${localesString})/e/:path*`,
				destination: "/:locale/events/:path*",
				permanent: true,
			},
			{
				source: "/e/:path*",
				destination: "/events/:path*",
				permanent: true,
			},
			{
				source: `/:locale(${localesString})/c/:path*`,
				destination: "/:locale/clubs/:path*",
				permanent: true,
			},
			{
				source: "/c/:path*",
				destination: "/clubs/:path*",
				permanent: true,
			},
		];
	},
	async rewrites() {
		return [
			// OAuth discovery for the MCP server. The better-auth mcp() plugin serves these
			// under /api/auth/.well-known/*, but connectors (e.g. claude.ai) probe the domain
			// root, so alias them here. The protected-resource wildcard covers the RFC 9728
			// resource-path form (/.well-known/oauth-protected-resource/api/mcp).
			{
				source: "/.well-known/oauth-authorization-server",
				destination: "http://localhost:3002/api/auth/.well-known/oauth-authorization-server",
			},
			{
				source: "/.well-known/oauth-protected-resource",
				destination: "http://localhost:3002/api/auth/.well-known/oauth-protected-resource",
			},
			{
				source: "/.well-known/oauth-protected-resource/:path*",
				destination: "http://localhost:3002/api/auth/.well-known/oauth-protected-resource",
			},
			{
				source: "/api/:path*",
				destination: "http://localhost:3002/api/:path*",
			},
			{
				source: `/:locale(${localesString})/api/:path*`,
				destination: "http://localhost:3002/api/:path*",
			},
			{
				source: `/:locale(${localesString})/warmind/static/:path*`,
				destination: "https://eu-assets.i.posthog.com/static/:path*",
			},
			{
				source: `/:locale(${localesString})/warmind/:path*`,
				destination: "https://eu.i.posthog.com/:path*",
			},
			{
				source: "/warmind/static/:path*",
				destination: "https://eu-assets.i.posthog.com/static/:path*",
			},
			{
				source: "/warmind/:path*",
				destination: "https://eu.i.posthog.com/:path*",
			},
		];
	},
	skipTrailingSlashRedirect: true,
} as NextConfig;

export default withAxiom(withNextIntl(nextConfig));
