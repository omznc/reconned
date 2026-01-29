import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { PurchasesTable } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/purchases-table";
import { AddPurchaseModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.form";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type PurchasesResponse = ApiResponse<"/api/clubs/{id}/purchases", "get">;

export async function SpendingPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/club/spending">) {
	const { clubId } = await props.params;
	const { page, perPage } = await props.searchParams;

	const currentPage = Math.max(1, Number(page || 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data } = await apiServer.GET("/api/clubs/{id}/purchases", {
		params: {
			path: {
				id: clubId,
			},
			query: {
				page: currentPage,
				perPage: pageSize,
			},
		},
	});

	const resp = data as PurchasesResponse | undefined;
	const purchases = resp?.purchases || [];
	const totalPurchases = resp?.pagination.total || 0;

	return <PurchasesTable purchases={purchases} totalPurchases={totalPurchases} pageSize={pageSize} />;
}

export default async function SpendingPage(props: PageProps<"/[locale]/dashboard/[clubId]/club/spending">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("Spending")}</h3>
				<AddPurchaseModal />
			</div>

			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<SpendingPageFetcher {...props} />
			</Suspense>
		</div>
	);
}
