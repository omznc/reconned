import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { parsePaging, tableSearchSchema } from "@/routes/{-$locale}/dashboard/$clubId/-lib/table-search";
import { MembersTable } from "@/routes/{-$locale}/dashboard/$clubId/members/-components/members-table";

const getMembersFn = createServerFn({ method: "GET" })
	.validator(tableSearchSchema.extend({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parsePaging(data.page, data.perPage);
		const { data: members, error } = await apiServer.GET("/api/clubs/{id}/members", {
			params: {
				path: { id: data.clubId },
				query: {
					page: currentPage,
					perPage: pageSize,
					search: data.search,
					role: data.role as "all" | "USER" | "MANAGER" | "CLUB_OWNER" | undefined,
					status: data.status as "ACTIVE" | "ARCHIVED" | "ALL" | undefined,
					sortBy: data.sortBy as "userName" | "userCallsign" | "role" | "createdAt" | undefined,
					sortOrder: data.sortOrder as "asc" | "desc" | undefined,
				},
			},
		});
		return error || !members ? null : { pageSize, members: members.members, totalMembers: members.total };
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/members/")({
	validateSearch: tableSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps }) => ({
		page: await getMembersFn({ data: { clubId: params.clubId, ...deps.search } }),
	}),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: MembersPage,
});

function MembersPage() {
	const t = useExtracted();
	const { user, access } = Route.useRouteContext();
	const { page } = Route.useLoaderData();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("All members")}</h3>
			</div>
			{page ? (
				<MembersTable
					members={page.members}
					totalMembers={page.totalMembers}
					pageSize={page.pageSize}
					currentUserId={user?.id}
					currentUserRole={access.role ?? undefined}
				/>
			) : (
				<div>Failed to load members</div>
			)}
		</>
	);
}
