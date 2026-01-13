import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api.ts";
import type { ApiResponse } from "@/lib/api/api-type-helpers.ts";
import { AllianceSheet } from "./_components/alliance.sheet";
import { AlliancesTable } from "./_components/alliances.table";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

export async function AlliancesPageFetcher(props: PageProps<"/[locale]/dashboard/admin/alliances">) {
	const { allianceId } = await props.searchParams;

	const { data: listData } = await apiServer.GET("/api/admin/alliances", {});

	const alliances = (listData?.alliances || []) as AdminAlliance[];

	const selectedAlliance = allianceId
		? (
				await apiServer.GET("/api/admin/alliances/{id}", {
					params: {
						path: { id: Number(allianceId) },
					},
				})
			).data?.alliance
		: undefined;

	return (
		<>
			<AllianceSheet selectedAlliance={selectedAlliance} />
			<AlliancesTable alliances={alliances} />
		</>
	);
}

export default async function AlliancesPage(props: PageProps<"/[locale]/dashboard/admin/alliances">) {
	const t = await getExtracted();
	const params = await props.params;

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("Alliances")}</h3>
			</div>
			<Suspense key={JSON.stringify(params)} fallback={<GenericDataTableSkeleton />}>
				<AlliancesPageFetcher {...props} />
			</Suspense>
		</>
	);
}
