import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { asWire, listDeps, listSearchSchema, parseListSearch } from "@/lib/list-search";
import { UserTable } from "@/routes/{-$locale}/dashboard/admin/users/-components/user-table";

type AdminUser = ApiResponse<"/api/admin/users", "get">["users"][number];

const getUsersFn = createServerFn({ method: "GET" })
	.validator(listSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize, search, sortBy, sortOrder } = parseListSearch(data);
		const { data: listData } = await apiServer.GET("/api/admin/users", {
			params: {
				query: {
					page: currentPage,
					perPage: pageSize,
					...(search ? { search } : {}),
					...(sortBy ? { sortBy: sortBy as "name" | "email" | "callsign" | "createdAt" } : {}),
					sortOrder,
				},
			},
		});
		return {
			users: asWire((listData?.users || []) as AdminUser[]),
			totalUsers: listData?.pagination.total || 0,
			pageSize,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/users/")({
	validateSearch: listSearchSchema,
	loaderDeps: ({ search }) => listDeps(search),
	loader: ({ deps }) => getUsersFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: UsersPage,
});

function UsersPage() {
	const t = useExtracted();
	const { users, totalUsers, pageSize } = Route.useLoaderData();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("All members")}</h3>
			</div>
			<UserTable users={users} totalUsers={totalUsers} pageSize={pageSize} />
		</>
	);
}
