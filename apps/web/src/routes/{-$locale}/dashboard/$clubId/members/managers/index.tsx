import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { NoAccessPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { parsePaging, tableSearchSchema } from "@/routes/{-$locale}/dashboard/$clubId/-lib/table-search";
import { AddManagerForm } from "@/routes/{-$locale}/dashboard/$clubId/members/managers/-components/manager.form";
import { ManagersTable } from "@/routes/{-$locale}/dashboard/$clubId/members/managers/-components/managers-table";

const getManagersFn = createServerFn({ method: "GET" })
	.validator(tableSearchSchema.extend({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parsePaging(data.page, data.perPage);
		const path = { id: data.clubId };
		const [club, members] = await Promise.all([
			apiServer.GET("/api/clubs/{id}", { params: { path } }),
			apiServer.GET("/api/clubs/{id}/members", {
				params: {
					path,
					query: {
						page: currentPage,
						perPage: pageSize,
						search: data.search,
						role: "MANAGER", // Filters for MANAGER and CLUB_OWNER.
						sortBy: data.sortBy as "userName" | "userCallsign" | "role" | "createdAt" | undefined,
						sortOrder: data.sortOrder as "asc" | "desc" | undefined,
					},
				},
			}),
		]);
		if (club.error || !club.data) {
			return { kind: "club-not-found" as const };
		}
		if (members.error || !members.data) {
			return { kind: "failed" as const };
		}
		const managers = members.data.members.filter(
			(member) => member.role === "MANAGER" || member.role === "CLUB_OWNER",
		);
		return { kind: "ok" as const, pageSize, managers, totalManagers: members.data.total };
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/members/managers/")({
	validateSearch: tableSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps, context }) => {
		// Admins who are not in the club are refused here, as before.
		if (context.access.role !== "MANAGER" && context.access.role !== "CLUB_OWNER") {
			return { kind: "forbidden" as const };
		}
		const page = await getManagersFn({ data: { clubId: params.clubId, ...deps.search } });
		if (page.kind === "club-not-found") {
			throw notFound();
		}
		return page;
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: ManagersPage,
});

function ManagersPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (page.kind === "forbidden") {
		return <NoAccessPage />;
	}
	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold mb-4">{t("Managers")}</h2>
				{page.kind === "ok" ? (
					<ManagersTable
						managers={page.managers}
						totalManagers={page.totalManagers}
						pageSize={page.pageSize}
					/>
				) : (
					<div>Failed to load managers</div>
				)}
			</div>
			<AddManagerForm />
		</div>
	);
}
