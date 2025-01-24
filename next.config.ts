import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const withNextIntl = createNextIntlPlugin();

const nextConfig = {
	reactStrictMode: true,
	experimental: {
		reactCompiler: true,
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
		],
	},
} as NextConfig;

export default withNextIntl(nextConfig);
