import { request as httpRequest } from "node:http";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import { nextIntlExtract } from "./vite/next-intl-extract.ts";

// The browser bundle reads the commit through `import.meta.env`, which only exposes `NEXT_PUBLIC_*`.
// Guarded: assigning `undefined` to `process.env` stores the string "undefined", which the browser bundle then inlines.
if (!process.env.NEXT_PUBLIC_SOURCE_COMMIT && process.env.SOURCE_COMMIT) {
	process.env.NEXT_PUBLIC_SOURCE_COMMIT = process.env.SOURCE_COMMIT;
}

const backendInternalUrl = new URL(process.env.BACKEND_INTERNAL_URL || "http://localhost:3002");

/**
 * Dev only. In production the edge proxy sends /api to the backend before it reaches this app.
 * Not `server.proxy`: Nitro's dev middleware runs before it and answers /api with the router 404.
 */
function devApiProxy(): Plugin {
	return {
		name: "dev-api-proxy",
		apply: "serve",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith("/api/")) {
					return next();
				}
				const upstream = httpRequest(
					{
						hostname: backendInternalUrl.hostname,
						port: backendInternalUrl.port,
						path: req.url,
						method: req.method,
						headers: req.headers,
					},
					(proxied) => {
						res.writeHead(proxied.statusCode ?? 502, proxied.headers);
						proxied.pipe(res);
					},
				);
				upstream.on("error", (error) => next(error));
				req.pipe(upstream);
			});
		},
	};
}

export default defineConfig({
	envPrefix: "NEXT_PUBLIC_",
	server: {
		port: Number(process.env.PORT) || 3000,
	},
	resolve: {
		tsconfigPaths: true,
		alias: [
			{ find: /^next-intl$/, replacement: new URL("./src/i18n/shim/client.ts", import.meta.url).pathname },
			{
				find: /^next-intl\/server$/,
				replacement: new URL("./src/i18n/shim/server.ts", import.meta.url).pathname,
			},
			{ find: /^server-only$/, replacement: new URL("./src/lib/empty-module.ts", import.meta.url).pathname },
		],
	},
	plugins: [
		devApiProxy(),
		nextIntlExtract(),
		tailwindcss(),
		tanstackStart({
			srcDirectory: "src",
			router: { routesDirectory: "routes" },
			// `*.client.ts` modules (api.client, auth-client) also run during SSR; they are not browser-only.
			importProtection: { server: { files: [] } },
		}),
		nitro({ preset: "bun" }),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});
