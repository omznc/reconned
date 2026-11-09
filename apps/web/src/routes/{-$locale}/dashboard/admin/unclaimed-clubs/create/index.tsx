import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { ErrorPage } from "@/components/error-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { CreateUnclaimedClubForm } from "@/routes/{-$locale}/dashboard/admin/unclaimed-clubs/create/-components/create-unclaimed-club-form";

const getCountriesFn = createServerFn({ method: "GET" }).handler(async () => {
	const { data, error } = await apiServer.GET("/api/countries");
	return error || !data ? null : data;
});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/unclaimed-clubs/create/")({
	loader: () => getCountriesFn(),
	notFoundComponent: NotFoundPage,
	component: CreateUnclaimedClubPage,
});

function CreateUnclaimedClubPage() {
	const t = useExtracted();
	const countries = Route.useLoaderData();

	if (!countries) {
		return <ErrorPage title={t("An error occurred")} />;
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
			<CreateUnclaimedClubForm countries={countries} />
		</div>
	);
}
