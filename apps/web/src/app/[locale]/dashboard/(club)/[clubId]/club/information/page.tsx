import { getExtracted } from "next-intl/server";
import { ClubInfoForm } from "@/app/[locale]/dashboard/(club)/[clubId]/club/information/_components/club-info.form";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/club/information">) {
	const params = await props.params;
	const t = await getExtracted();
	const user = await isAuthenticated();
	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const [clubResp, countries] = await Promise.all([
		apiServer.GET("/api/clubs/{id}/information", {
			params: {
				path: { id: params.clubId },
			},
		}),
		apiServer.GET("/api/countries"),
	]);

	const club = clubResp.data;
	const countriesData = countries.data;

	if (!club || !countriesData) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	// Fetch Instagram auth URL from backend
	const { data: authUrlData } = await apiServer.GET("/api/clubs/{id}/instagram/auth-url", {
		params: { path: { id: params.clubId } },
	});

	const authUrl = authUrlData?.authUrl || "";

	return (
		<div className="p-6">
			<ClubInfoForm
				club={club}
				countries={countriesData}
				isClubOwner={club.isCurrentUserOwner}
				instagramConnectionUrl={authUrl}
			/>
		</div>
	);
}
