import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { AllianceSheet } from "@/app/[locale]/dashboard/(platform)/admin/alliances/_components/alliance.sheet";
import { AllianceDelete } from "@/app/[locale]/dashboard/(platform)/admin/alliances/_components/alliance-delete.tsx";
import { AllianceForm } from "@/app/[locale]/dashboard/(platform)/admin/alliances/_components/alliance-form.tsx";
import { AlliancesTable } from "@/app/[locale]/dashboard/(platform)/admin/alliances/_components/alliances.table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

export async function AlliancesPageFetcher(props: PageProps<"/[locale]/dashboard/admin/alliances">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, allianceId, mode, perPage } = searchParams;
	const currentPage = Math.max(1, Number(page || 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data: listData } = await apiServer.GET("/api/admin/alliances", {
		params: {
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(sortBy ? { sortBy: sortBy as "name" | "createdAt" } : {}),
				sortOrder: sortOrder === "asc" ? "asc" : "desc",
			},
		},
	});

	const alliances = (listData?.alliances || []) as AdminAlliance[];
	const totalAlliances = listData?.pagination?.total || 0;

	// Only fetch individual alliance when we need it for forms/dialogs/sheets
	let selectedAlliance: ApiResponse<"/api/admin/alliances/{id}", "get">["alliance"] | undefined;
	if (allianceId && (mode === "edit" || mode === "delete" || !mode)) {
		const response = await apiServer.GET("/api/admin/alliances/{id}", {
			params: {
				path: { id: Number(allianceId) },
			},
		});
		selectedAlliance = response.data?.alliance;
	}

	return (
		<>
			{mode === "create" || (mode === "edit" && selectedAlliance) ? (
				<AllianceForm alliance={selectedAlliance} />
			) : (
				<AllianceSheet selectedAlliance={selectedAlliance} />
			)}
			<AllianceDelete alliance={selectedAlliance} />
			<AlliancesTable alliances={alliances} totalAlliances={totalAlliances} pageSize={pageSize} />
		</>
	);
}

export default async function AlliancesPage(props: PageProps<"/[locale]/dashboard/admin/alliances">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	// Create a key that only includes parameters that affect data fetching
	const dataKey = JSON.stringify({
		search: searchParams.search,
		sortBy: searchParams.sortBy,
		sortOrder: searchParams.sortOrder,
		page: searchParams.page,
		perPage: searchParams.perPage,
	});

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Alliances")}</h3>
				<p className="text-sm text-muted-foreground">{t("Manage alliances and their member clubs")}</p>
			</div>
			<Suspense key={dataKey} fallback={<GenericDataTableSkeleton />}>
				<AlliancesPageFetcher {...props} />
			</Suspense>
		</>
	);
}
