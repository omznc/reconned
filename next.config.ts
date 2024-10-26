import type { source } from "framer-motion/client";

const nextConfig = {
	reactStrictMode: true,
	experimental: {
		reactCompiler: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: process.env.NEXT_PUBLIC_CDN_URL?.split("://")[1],
			},
		],
	},
};

module.exports = nextConfig;
