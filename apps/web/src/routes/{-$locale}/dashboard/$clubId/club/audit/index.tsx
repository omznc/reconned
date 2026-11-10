import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { serializable } from "@/routes/{-$locale}/dashboard/$clubId/-lib/serializable";
import { parsePaging, tableSearchSchema } from "@/routes/{-$locale}/dashboard/$clubId/-lib/table-search";
import { AuditLogsTable } from "@/routes/{-$locale}/dashboard/$clubId/club/audit/-components/audit-logs-table";

const getAuditLogsFn = createServerFn({ method: "GET" })
	.validator(tableSearchSchema.extend({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parsePaging(data.page, data.perPage);
		const { data: logs, error } = await apiServer.GET("/api/clubs/{id}/audit-logs", {
			params: {
				path: { id: data.clubId },
				query: {
					page: currentPage,
					perPage: pageSize,
					...(data.search ? { search: data.search } : {}),
					...(data.actionType && data.actionType !== "all" ? { actionType: data.actionType } : {}),
				},
			},
		});
		return serializable({
			pageSize,
			logs: error || !logs ? [] : logs.logs,
			totalLogs: error || !logs ? 0 : logs.pagination.total,
		});
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/club/audit/")({
	validateSearch: tableSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps, context }) => {
		const t = await getExtracted({ locale: context.locale });
		const table = await getAuditLogsFn({ data: { clubId: params.clubId, ...deps.search } });
		return { ...table, title: t("Audit Log") };
	},
	head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? "" }] }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: AuditLogsPage,
});

function AuditLogsPage() {
	const t = useExtracted();
	const { logs, totalLogs, pageSize } = Route.useLoaderData();

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">{t("Audit Log")}</h2>
				<p className="text-muted-foreground">{t("View all actions performed in this club.")}</p>
			</div>
			<AuditLogsTable logs={logs} totalLogs={totalLogs} pageSize={pageSize} />
		</div>
	);
}
