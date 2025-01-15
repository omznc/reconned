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
				hostname: "s3-airsoft.omarzunic.com",
			},
			{
				protocol: "https",
				hostname: "cdn.reconned.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
		],
	},
	webpack: {
		configure: {
			ignoreWarnings: [{ module: /@opentelemetry\/instrumentation/ }],
		},
	},
};

module.exports = nextConfig;
