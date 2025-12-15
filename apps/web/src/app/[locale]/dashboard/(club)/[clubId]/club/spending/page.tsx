import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { PurchasesTable } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/purchases-table";
import { AddPurchaseModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.form";
import { ErrorPage } from "@/components/error-page";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiClient, { type ApiResponse } from "@/lib/api";
import { FEATURE_FLAGS } from "@/lib/server-utils";

type PurchasesResponse = ApiResponse<"/api/clubs/{id}/purchases", "get">;

export async function SpendingPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/club/spending">) {
	const { clubId } = await props.params;
	const { page, perPage } = await props.searchParams;

	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data } = await apiClient.GET("/api/clubs/{id}/purchases", {
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
	const purchases = resp?.purchases ?? [];
	const totalPurchases = resp?.pagination.total ?? 0;

	return <PurchasesTable purchases={purchases} totalPurchases={totalPurchases} pageSize={pageSize} />;
}

export default async function SpendingPage(props: PageProps<"/[locale]/dashboard/[clubId]/club/spending">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	if (!FEATURE_FLAGS.CLUBS_SPENDING) {
		return <ErrorPage title={t("Spending")} />;
	}

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
