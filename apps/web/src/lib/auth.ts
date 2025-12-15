import { headers } from "next/headers";
import apiClient from "@/lib/api";
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

	// Fetch managed clubs from backend API
	const { data: managedClubsData } = await apiClient.GET("/api/clubs/managed", {});

	const managedClubs = managedClubsData?.clubs || [];

	return {
		...result.data.user,
		managedClubs: managedClubs.map((club) => club.id),
		session: result.data.session,
	};
};
