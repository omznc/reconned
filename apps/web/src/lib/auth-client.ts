import { passkeyClient } from "@better-auth/passkey/client";
import type { auth } from "backend/lib/auth";
import { adminClient, inferAdditionalFields, lastLoginMethodClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "./env";

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
		inferAdditionalFields<typeof auth>(),
	],
});

export function useIsAuthenticated() {
	const session = authClient.useSession();

	return {
		user: session?.data?.user,
		loading: session.isPending,
	};
}
