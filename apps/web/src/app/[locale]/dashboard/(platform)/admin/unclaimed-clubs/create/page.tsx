import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import apiServer from "@/lib/api/api";
import { CreateUnclaimedClubForm } from "./_components/create-unclaimed-club-form";

export default async function CreateUnclaimedClubPage() {
	const t = await getExtracted();
	const { data, error } = await apiServer.GET("/api/countries");

	if (error) {
		notFound();
	}

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">{t("Create unclaimed club")}</h3>
				<p className="text-muted-foreground">
					{t(
						"Create a club that can be claimed by users. The club will appear on the public page but won't have an owner until someone claims it.",
					)}
				</p>
			</div>
			<CreateUnclaimedClubForm countries={data} />
		</div>
	);
}
