import { getTranslations } from "next-intl/server";
import { getCountries } from "@/lib/cached-countries";
import { CreateUnclaimedClubForm } from "./_components/create-unclaimed-club-form";

export default async function CreateUnclaimedClubPage() {
	const t = await getTranslations();
	const countries = await getCountries();

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">{t("dashboard.admin.unclaimedClubs.createTitle")}</h3>
				<p className="text-muted-foreground">{t("dashboard.admin.unclaimedClubs.createDescription")}</p>
			</div>
			<CreateUnclaimedClubForm countries={countries} />
		</div>
	);
}
