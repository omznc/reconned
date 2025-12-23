import { getExtracted } from "next-intl/server";
import { EditClubForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/edit-club-form";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { isAuthenticated } from "@/lib/auth";

type AdminUnclaimed = ApiResponse<"/api/admin/unclaimed-clubs/{id}", "get">;
type CountriesResponse = ApiResponse<"/api/countries", "get">;

export default async function EditUnclaimedClubPage(
	props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs/edit">,
) {
	const searchParams = await props.searchParams;
	const { clubId } = searchParams;

	const t = await getExtracted();

	if (!clubId) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	const user = await isAuthenticated();
	if (!user || user.role !== "admin") {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const [clubResp, countriesResp] = await Promise.all([
		apiServer.GET("/api/admin/unclaimed-clubs/{id}", {
			params: {
				path: { id: clubId as string },
			},
		}),
		apiServer.GET("/api/countries"),
	]);

	const club = clubResp.data as AdminUnclaimed | undefined;
	const countries = countriesResp.data as CountriesResponse | undefined;

	if (!club || !countries || club._count.members > 0) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">{t("Edit unclaimed club")}</h3>
				<p className="text-muted-foreground">{t("Edit the information for this unclaimed club.")}</p>
			</div>
			<EditClubForm club={club} countries={countries} />
		</div>
	);
}
