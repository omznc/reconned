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
	reactCompiler: true,
	experimental: {
		// turbopackRustReactCompiler: true,
		staleTimes: {
			dynamic: 0,
			static: 180,
		},
		serverComponentsHmrCache: true,
	},
	images: {
		loader: "custom",
		loaderFile: "./image-loader.ts",
		qualities: [50, 75, 100],
	},
	// `backend` is not listed: its only import in this app is a type-only import in
	// src/lib/auth-client.ts, which is erased at compile time.
	//
	// postcss (a sanitize-html dependency used in client components) is on Next's default
	// server-external list, so its SSR chunks `require()` it at runtime through an alias
	// symlink turbopack writes lazily under .next. The first request can race that symlink
	// and crash server rendering (breaks /events/[id]/apply in CI). Bundling it avoids the
	// runtime resolution entirely.
	transpilePackages: ["postcss"],
	async redirects() {
		return [
			{
				source: "/sign-in",
				destination: "/login",
				permanent: false,
			},
			{
				source: `/:locale(${localesString})/sign-in`,
				destination: "/:locale/login",
				permanent: false,
			},
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
		// Same override proxy.ts uses; lets the E2E harness point the dev rewrite at an
		// isolated backend instead of the default dev one.
		const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:3002";
		return [
			// OAuth discovery is handled in proxy.ts (middleware), which avoids the
			// same-origin rewrite issue and works in both dev and Docker. The next.config
			// rewrites below (/api/, locale-prefixed, etc.) are dev-only — in production
			// the edge proxy routes those paths to the backend before reaching Next.js.
			//
			// There used to be three `/.well-known/oauth-*` rewrites here. They were unreachable:
			// middleware runs before rewrites, and proxy.ts already claims those paths. They also
			// hardcoded `localhost:3002`, which resolves to nothing inside the standalone web
			// container — so had they ever fired in production they would have failed anyway.
			{
				source: "/api/:path*",
				destination: `${backendInternalUrl}/api/:path*`,
			},
			{
				source: `/:locale(${localesString})/api/:path*`,
				destination: `${backendInternalUrl}/api/:path*`,
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
