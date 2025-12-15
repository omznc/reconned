import { notFound } from "next/navigation";
import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import apiClient, { type ApiResponse } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

type ClubInfoResponse = ApiResponse<"/api/clubs/{id}/information", "get">;
type CountriesResponse = ApiResponse<"/api/countries", "get">;

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/information">) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const [clubResp, countries] = await Promise.all([
		apiClient.GET("/api/clubs/{id}/information", {
			params: {
				path: { id: params.clubId },
			},
		}),
		apiClient.GET("/api/countries"),
	]);

	const club = clubResp.data as ClubInfoResponse | undefined;
	const countriesData = countries.data as CountriesResponse | undefined;

	if (!club || !countriesData) {
		return notFound();
	}

	// Fetch Instagram auth URL from backend
	const { data: authUrlData } = await apiClient.GET("/api/clubs/{id}/instagram/auth-url", {
		params: { path: { id: params.clubId } },
	});

	const authUrl = authUrlData?.authUrl || "";

	return (
		<div className="p-6">
			<ClubInfoForm
				club={club}
				countries={countriesData}
				isClubOwner={club.isOwner === true}
				instagramConnectionUrl={authUrl}
			/>
		</div>
	);
}
