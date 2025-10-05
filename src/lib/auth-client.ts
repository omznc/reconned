import {
	adminClient,
	lastLoginMethodClient,
	oneTapClient,
	passkeyClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { env } from "@/lib/env";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
	plugins: [
		passkeyClient(),
		oneTapClient({
			clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
		}),
		adminClient(),
		twoFactorClient(),
		lastLoginMethodClient(),
	],
});

export function useIsAuthenticated() {
	const session = authClient.useSession();

	return {
		user: session?.data?.user,
		loading: session.isPending,
	};
}
