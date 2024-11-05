import { env } from "@/lib/env";

const nextConfig = {
	reactStrictMode: true,
	experimental: {
		reactCompiler: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: env.NEXT_PUBLIC_CDN_URL?.split("://")[1],
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
		],
	},
};

module.exports = nextConfig;
