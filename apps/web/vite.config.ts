import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { nextIntlExtract } from "./vite/next-intl-extract.ts";

// The browser bundle reads the commit through `import.meta.env`, which only exposes `NEXT_PUBLIC_*`.
// Guarded: assigning `undefined` to `process.env` stores the string "undefined", which the browser bundle then inlines.
if (!process.env.NEXT_PUBLIC_SOURCE_COMMIT && process.env.SOURCE_COMMIT) {
	process.env.NEXT_PUBLIC_SOURCE_COMMIT = process.env.SOURCE_COMMIT;
}

const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:3002";

export default defineConfig({
	envPrefix: "NEXT_PUBLIC_",
	server: {
		port: Number(process.env.PORT) || 3000,
		// Dev only. In production the edge proxy sends /api to the backend before it reaches this app.
		proxy: {
			"/api": { target: backendInternalUrl, changeOrigin: false },
		},
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
