import { headers } from "next/headers";
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

	return {
		...result.data.user,
		session: result.data.session,
	};
};
