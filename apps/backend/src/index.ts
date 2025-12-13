import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";
import { betterAuthElysia, OpenAPI } from "./lib/auth";
import { env } from "./lib/env";

const [components, paths] = await Promise.all([OpenAPI.components, OpenAPI.getPaths()]);

const corsOrigins = env.CORS_ORIGINS.split(",").map((origin: string) => origin.trim());

const app = new Elysia()
	.use(
		cors({
			origin: corsOrigins,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization", "X-Captcha-Response"],
		}),
	)
	.use(betterAuthElysia)
	.use(
		openapi({
			documentation: {
				components,
				paths,
			},
		}),
	)
	.listen(3002);

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);
