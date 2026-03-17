import { passkeyClient } from "@better-auth/passkey/client";
import type { AuthType } from "backend/lib/auth-types";
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
		inferAdditionalFields<AuthType>(),
	],
});

export function useIsAuthenticated() {
	const session = authClient.useSession();

	return {
		user: session?.data?.user,
		loading: session.isPending,
	};
}
