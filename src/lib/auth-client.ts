import { cache, useEffect, useState } from "react";
import { env } from "@/lib/env";
import { oneTapClient, passkeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { unstable_cache } from "next/cache";

export const authClient = createAuthClient({
	baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
	plugins: [
		passkeyClient(),
		oneTapClient({
			clientId: env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
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
