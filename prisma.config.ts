import { defineConfig } from "prisma/config";
import "dotenv/config";
import { env } from "prisma/config";

export default defineConfig({
	schema: "prisma",
	datasource: {
		url: env("DATABASE_URL"),
	},
});
