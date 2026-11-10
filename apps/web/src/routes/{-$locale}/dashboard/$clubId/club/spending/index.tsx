import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { parsePaging, tableSearchSchema } from "@/routes/{-$locale}/dashboard/$clubId/-lib/table-search";
import { PurchasesTable } from "@/routes/{-$locale}/dashboard/$clubId/club/spending/-components/purchases-table";
import { AddPurchaseModal } from "@/routes/{-$locale}/dashboard/$clubId/club/spending/-components/spending.form";

const spendingSearchSchema = tableSearchSchema.pick({ page: true, perPage: true });

const getPurchasesFn = createServerFn({ method: "GET" })
	.validator(spendingSearchSchema.extend({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parsePaging(data.page, data.perPage);
		const { data: resp } = await apiServer.GET("/api/clubs/{id}/purchases", {
			params: { path: { id: data.clubId }, query: { page: currentPage, perPage: pageSize } },
		});
		return { pageSize, purchases: resp?.purchases || [], totalPurchases: resp?.pagination.total || 0 };
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/spending/")({
	validateSearch: spendingSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ params, deps }) => getPurchasesFn({ data: { clubId: params.clubId, ...deps.search } }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: SpendingPage,
});

function SpendingPage() {
	const t = useExtracted();
	const { purchases, totalPurchases, pageSize } = Route.useLoaderData();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("Spending")}</h3>
				<AddPurchaseModal />
			</div>
			<PurchasesTable purchases={purchases} totalPurchases={totalPurchases} pageSize={pageSize} />
		</div>
	);
}
