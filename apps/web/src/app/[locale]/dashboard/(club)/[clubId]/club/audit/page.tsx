import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { AuditLogsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/club/audit/_components/audit-logs-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";

export async function generateMetadata() {
	const t = await getExtracted();

	return {
		title: t("Audit Log"),
	};
}

async function AuditLogsPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/club/audit">) {
	const { clubId } = await props.params;
	const { search, page, perPage, actionType } = await props.searchParams;

	// Parse pagination parameters
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data, error } = await apiServer.GET("/api/clubs/{id}/audit-logs", {
		params: {
			path: { id: clubId },
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(actionType && actionType !== "all" ? { actionType: actionType as string } : {}),
			},
		},
	});

	if (error || !data) {
		return <AuditLogsTable logs={[]} totalLogs={0} pageSize={pageSize} />;
	}

	return <AuditLogsTable logs={data.logs} totalLogs={data.pagination.total} pageSize={pageSize} />;
}

export default async function AuditLogsPage(props: PageProps<"/[locale]/dashboard/[clubId]/club/audit">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">{t("Audit Log")}</h2>
				<p className="text-muted-foreground">{t("View all actions performed in this club.")}</p>
			</div>

			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<AuditLogsPageFetcher {...props} />
			</Suspense>
		</div>
	);
}
