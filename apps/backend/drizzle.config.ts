import { defineConfig } from "drizzle-kit";
import { env } from "./src/lib/env";

export default defineConfig({
	dialect: "postgresql",
	out: "./src/drizzle",
	schema: "./src/drizzle/schema.ts",
	dbCredentials: {
		url: env.DATABASE_URL,
	},
	strict: true,
	verbose: process.env.NODE_ENV === "development",
});
