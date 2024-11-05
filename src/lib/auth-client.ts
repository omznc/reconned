import { oneTapClient, passkeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: process.env.BETTER_AUTH_URL,
	plugins: [
		passkeyClient(),
		oneTapClient({
			clientId: process.env.GOOGLE_CLIENT_ID as string,
		}),
	],
});

export function useIsAuthenticated() {
	const session = authClient.useSession();
	return {
		user: session?.data?.user,
		loading: session.isPending,
	};
}
