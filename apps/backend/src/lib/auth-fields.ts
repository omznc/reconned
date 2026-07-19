/**
 * The extra columns this app adds to better-auth's `user` model.
 *
 * This module deliberately has **no imports**. It is the one piece of the auth configuration the
 * web app needs to know about, and keeping it free of dependencies means `apps/web` can import its
 * type without dragging in the whole auth instance — which would pull the drizzle adapter, the
 * database client and every plugin's generics into the web app's typecheck.
 *
 * Anything added here must also be added to the client literal in
 * `apps/web/src/lib/auth-client.ts`; that literal is declared `satisfies UserAdditionalFields`, so
 * the two drifting apart is a compile error rather than a runtime surprise.
 */
export const userAdditionalFields = {
	callsign: {
		type: "string",
		default: "",
		input: true,
		required: false,
	},
	language: {
		type: "string",
		default: "bs",
		input: true,
		required: false,
	},
	font: {
		type: "string",
		default: "sans",
		input: true,
		required: false,
	},
	theme: {
		type: "string",
		required: false,
	},
	style: {
		type: "string",
		default: "relaxed",
		input: true,
		required: false,
	},
} as const;

export type UserAdditionalFields = typeof userAdditionalFields;
