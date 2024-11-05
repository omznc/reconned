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
		RESEND_API_KEY: z.string().min(1),
		ALLOWED_FILE_TYPES: z.string().optional(),
		MAX_FILE_SIZE: z.string().optional(),
	},
	client: {
		NEXT_PUBLIC_CDN_URL: z.string().url(),
		NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url(),
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1),
	},
	experimental__runtimeEnv: {
		NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
		NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
		NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
	},
});
