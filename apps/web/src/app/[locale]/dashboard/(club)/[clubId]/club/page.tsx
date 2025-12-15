import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/overviews/club-overview";
import apiClient, { type ApiResponse } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

type ClubResponse = ApiResponse<"/api/clubs/{id}", "get">;

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club">) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const { data } = await apiClient.GET("/api/clubs/{id}", {
		params: {
			path: {
				id: params.clubId,
			},
		},
	});

	const club = data as ClubResponse | undefined;

	if (!club) {
		return notFound();
	}

	const isManager = user.managedClubs.includes(club.id) || Boolean(user.role === "admin");

	return <ClubOverview club={club} isManager={isManager} isMember={true} currentUserMembership={null} />;
}
