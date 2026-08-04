import { passkeyClient } from "@better-auth/passkey/client";
import type { UserAdditionalFields } from "backend/lib/auth-fields";
import {
	adminClient,
	inferAdditionalFields,
	lastLoginMethodClient,
	oneTapClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createMcpAuthClient } from "better-auth/plugins/mcp/client";
import { createAuthClient } from "better-auth/react";
import { env } from "./env";

/**
 * The server's extra `user` columns, declared explicitly rather than inferred from `typeof auth`.
 *
 * `inferAdditionalFields<typeof auth>()` used to do this, which meant instantiating the entire
 * server auth instance's type here — drizzle adapter, database client and every plugin's generics
 * — just to learn five field names. The `satisfies` below keeps the safety that bought us: this
 * literal must still match `apps/backend/src/lib/auth-fields.ts` exactly, or the build fails.
 */
const userAdditionalFields = {
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
} as const satisfies UserAdditionalFields;

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_BACKEND_URL,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [
		passkeyClient(),
		adminClient(),
		twoFactorClient(),
		lastLoginMethodClient(),
		oneTapClient({
			clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
			context: "signin",
			cancelOnTapOutside: true,
		}),
		inferAdditionalFields({ user: userAdditionalFields }),
	],
});

export function useIsAuthenticated() {
	const session = authClient.useSession();

	return {
		user: session?.data?.user,
		loading: session.isPending,
	};
}

export const mcpAuth = createMcpAuthClient({
	authURL: `${env.NEXT_PUBLIC_BACKEND_URL}/api/auth`,
});
