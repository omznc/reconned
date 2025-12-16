import { notFound } from "next/navigation";
import { ClubOverview } from "@/components/overviews/club-overview";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { isAuthenticated } from "@/lib/auth";

type ClubResponse = ApiResponse<"/api/clubs/{id}", "get">;

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club">) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const [{ data }, { data: membershipData }] = await Promise.all([
		apiServer.GET("/api/clubs/{id}", {
			params: {
				path: {
					id: params.clubId,
				},
			},
		}),
		apiServer.GET("/api/clubs/{id}/membership", {
			params: {
				path: {
					id: params.clubId,
				},
			},
		}),
	]);

	const club = data as ClubResponse | undefined;

	if (!club) {
		return notFound();
	}

	const role = membershipData?.membership?.role;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER" || user.role === "admin";
	const isMember = membershipData?.isMember ?? false;

	return (
		<ClubOverview
			club={club}
			isManager={isManager}
			isMember={isMember}
			currentUserMembership={membershipData?.membership ?? null}
		/>
	);
}
