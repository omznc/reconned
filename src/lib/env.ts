import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().url(),
		BETTER_AUTH_SECRET: z.string().min(1),
		S3_ENDPOINT: z.string().url(),
		S3_REGION: z.string().min(1),
		S3_ACCESS_KEY_ID: z.string().min(1),
		S3_SECRET_ACCESS_KEY: z.string().min(1),
		S3_BUCKET_NAME: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		PLAUSIBLE_API_KEY: z.string().min(1),
		PLAUSIBLE_HOST: z.string().url(),
		PLAUSIBLE_SITE_ID: z.string().min(1),
		ONESIGNAL_APP_ID: z.string().min(1),
		ONESIGNAL_API_KEY: z.string().min(1),
		ADMIN_WEBHOOK_TOKEN: z.string().min(1),
		TURNSTILE_SECRET_KEY: z.string().min(1),
		// Facebook Graph API credentials (for Instagram integration)
		FACEBOOK_APP_ID: z.string().min(1),
		FACEBOOK_APP_SECRET: z.string().min(1),
		// POLAR_ACCESS_TOKEN: z.string().min(1), This is a surprise tool that will help us later
	},
	client: {
		NEXT_PUBLIC_CDN_URL: z.string().url(),
		NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url(),
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1),
		NEXT_PUBLIC_ALLOWED_FILE_TYPES: z.string().optional(),
		NEXT_PUBLIC_MAX_FILE_SIZE: z.string().optional(), // 5 MB
		NEXT_PUBLIC_SOURCE_COMMIT: z.string().optional(),
		NEXT_PUBLIC_IMGUR_CLIENT_ID: z.string().min(1),
		NEXT_PUBLIC_CI: z.string().optional(),
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
		NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		NEXT_PUBLIC_ALLOWED_FILE_TYPES: process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES,
		NEXT_PUBLIC_MAX_FILE_SIZE: process.env.NEXT_PUBLIC_MAX_FILE_SIZE,
		NEXT_PUBLIC_SOURCE_COMMIT: process.env.SOURCE_COMMIT,
		NEXT_PUBLIC_IMGUR_CLIENT_ID: process.env.NEXT_PUBLIC_IMGUR_CLIENT_ID,
		NEXT_PUBLIC_CI: process.env.NEXT_PUBLIC_CI,
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
	},
});
