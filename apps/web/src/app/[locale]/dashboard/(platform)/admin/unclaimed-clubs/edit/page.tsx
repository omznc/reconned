import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { EditClubForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/edit-club-form";
import apiClient, { type ApiResponse } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

type AdminUnclaimed = ApiResponse<"/api/admin/unclaimed-clubs/{id}", "get">;
type CountriesResponse = ApiResponse<"/api/countries", "get">;

export default async function EditUnclaimedClubPage(
	props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs/edit">,
) {
	const searchParams = await props.searchParams;
	const { clubId } = searchParams;

	if (!clubId) {
		return notFound();
	}

	const user = await isAuthenticated();
	if (!user || user.role !== "admin") {
		return notFound();
	}

	const [clubResp, countriesResp] = await Promise.all([
		apiClient.GET("/api/admin/unclaimed-clubs/{id}", {
			params: {
				path: { id: clubId as string },
			},
		}),
		apiClient.GET("/api/countries"),
	]);

	const club = clubResp.data as AdminUnclaimed | undefined;
	const countries = countriesResp.data as CountriesResponse | undefined;

	if (!club || !countries || club.hasOwner) {
		return notFound();
	}

	const t = await getExtracted();

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
