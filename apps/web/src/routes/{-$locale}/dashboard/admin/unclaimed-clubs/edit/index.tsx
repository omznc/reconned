import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { EditClubForm } from "@/routes/{-$locale}/dashboard/admin/unclaimed-clubs/-components/edit-club-form";

const editSearchSchema = z.looseObject({ clubId: z.union([z.string(), z.number()]).optional() });

const getUnclaimedClubFn = createServerFn({ method: "GET" })
	.validator(z.object({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const [clubResp, countriesResp] = await Promise.all([
			apiServer.GET("/api/admin/unclaimed-clubs/{id}", { params: { path: { id: data.clubId } } }),
			apiServer.GET("/api/countries"),
		]);
		const club = clubResp.data;
		const countries = countriesResp.data;
		if (!club || !countries || club._count.members > 0) {
			return null;
		}
		return { club, countries };
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/unclaimed-clubs/edit/")({
	validateSearch: editSearchSchema,
	loaderDeps: ({ search }) => ({ clubId: search.clubId }),
	loader: ({ deps }) => (deps.clubId ? getUnclaimedClubFn({ data: { clubId: String(deps.clubId) } }) : null),
	notFoundComponent: NotFoundPage,
	component: EditUnclaimedClubPage,
});

function EditUnclaimedClubPage() {
	const t = useExtracted();
	const result = Route.useLoaderData();

	if (!result) {
		return <ErrorPage title={t("Club not found.")} />;
	}

	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-lg font-semibold">{t("Edit unclaimed club")}</h3>
				<p className="text-muted-foreground">{t("Edit the information for this unclaimed club.")}</p>
			</div>
			<EditClubForm club={result.club} countries={result.countries} />
		</div>
	);
}
