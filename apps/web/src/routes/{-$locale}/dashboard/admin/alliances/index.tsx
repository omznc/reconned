import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { listDeps, listSearchSchema, parseListSearch } from "@/lib/list-search";
import { AllianceSheet } from "@/routes/{-$locale}/dashboard/admin/alliances/-components/alliance.sheet";
import { AllianceForm } from "@/routes/{-$locale}/dashboard/admin/alliances/-components/alliance-form";
import { AlliancesTable } from "@/routes/{-$locale}/dashboard/admin/alliances/-components/alliances.table";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

const queryValue = z.union([z.string(), z.number()]).optional();
const alliancesSearchSchema = listSearchSchema.extend({ allianceId: queryValue, viewId: queryValue });

const getAlliancesFn = createServerFn({ method: "GET" })
	.validator(alliancesSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize, search, sortBy, sortOrder } = parseListSearch(data);
		const allianceId = data.allianceId === undefined ? undefined : String(data.allianceId);
		const viewId = data.viewId === undefined ? undefined : String(data.viewId);

		const { data: listData } = await apiServer.GET("/api/admin/alliances", {
			params: {
				query: {
					page: currentPage,
					perPage: pageSize,
					...(search ? { search } : {}),
					...(sortBy ? { sortBy: sortBy as "name" | "createdAt" } : {}),
					sortOrder,
				},
			},
		});

		const idToFetch = allianceId && allianceId !== "new" ? allianceId : viewId;
		const selectedAlliance = idToFetch
			? (
					await apiServer.GET("/api/admin/alliances/{id}", {
						params: { path: { id: Number(idToFetch) } },
					})
				).data?.alliance
			: undefined;

		return {
			alliances: (listData?.alliances || []) as AdminAlliance[],
			totalAlliances: listData?.pagination?.total || 0,
			pageSize,
			selectedAlliance,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/alliances/")({
	validateSearch: alliancesSearchSchema,
	loaderDeps: ({ search }) => ({ ...listDeps(search), allianceId: search.allianceId, viewId: search.viewId }),
	loader: ({ deps }) => getAlliancesFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: AlliancesPage,
});

function AlliancesPage() {
	const t = useExtracted();
	const { alliances, totalAlliances, pageSize, selectedAlliance } = Route.useLoaderData();
	const { allianceId } = Route.useSearch();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Alliances")}</h3>
				<p className="text-sm text-muted-foreground">{t("Manage alliances and their member clubs")}</p>
			</div>
			{(allianceId === "new" || (allianceId && selectedAlliance)) && <AllianceForm alliance={selectedAlliance} />}
			<AllianceSheet selectedAlliance={selectedAlliance} />
			<AlliancesTable alliances={alliances} totalAlliances={totalAlliances} pageSize={pageSize} />
		</>
	);
}
