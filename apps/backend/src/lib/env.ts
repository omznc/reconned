import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	skipValidation: process.env.CI === "true",
	server: {
		DATABASE_URL: z.url(),
		BETTER_AUTH_SECRET: z.string().min(1),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGINS: z.string().min(1).default("http://localhost:3000,https://reconned.com,https://beta.reconned.com"),
		GOOGLE_CLIENT_ID: z.string().min(1),
		GOOGLE_CLIENT_SECRET: z.string().min(1),
		REDIS_URL: z.url(),
		ONESIGNAL_APP_ID: z.string().min(1),
		ONESIGNAL_API_KEY: z.string().min(1),
		TURNSTILE_SECRET_KEY: z.string().min(1),
		S3_ENDPOINT: z.url(),
		S3_REGION: z.string().min(1),
		S3_ACCESS_KEY_ID: z.string().min(1),
		S3_SECRET_ACCESS_KEY: z.string().min(1),
		S3_BUCKET_NAME: z.string().min(1),
		CDN_URL: z.url(),
		CI: z.string().optional(),
	},
	runtimeEnv: process.env,
});
