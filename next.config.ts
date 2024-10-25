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
				hostname: "airsoftba.s3.eu-central-003.backblazeb2.com",
			},
			{
				protocol: "https",
				hostname: "f003.backblazeb2.com",
			},
		],
	},
};

module.exports = nextConfig;
