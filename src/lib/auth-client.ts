import { use, useEffect, useState } from "react";
import { env } from "@/lib/env";
import { oneTapClient, passkeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

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
	const [managedClubs, setManagedClubs] = useState<string[] | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (managedClubs !== null) {
			return;
		}

		authClient.$fetch("managed-clubs").then((data) => {
			const managedClubs = data.data as string[];
			setManagedClubs(managedClubs);
			setLoading(false);
		});
	}, [managedClubs]);

	return {
		user: {
			...session?.data?.user,
			managedClubs,
		},
		loading: session.isPending || loading,
	};
}
