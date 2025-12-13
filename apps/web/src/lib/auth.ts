import { headers } from "next/headers";
import { fetchManagedClubs } from "@/app/api/club/managed/fetch-managed-clubs";
import { authClient } from "@/lib/auth-client";

export const isAuthenticated = async () => {
	const result = await authClient.getSession({
		fetchOptions: {
			headers: await headers(),
			cache: "no-store",
		},
	});

	if (!result.data?.user?.id) {
		return null;
	}

	const managedClubs = await fetchManagedClubs(result.data.user.id);

	return {
		...result.data.user,
		managedClubs,
		session: result.data.session,
	};
};
