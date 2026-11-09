import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { listDeps, listSearchSchema, parseListSearch } from "@/lib/list-search";
import { ClubsTable } from "@/routes/{-$locale}/dashboard/admin/clubs/-components/clubs.table";

type AdminClub = ApiResponse<"/api/admin/clubs", "get">["clubs"][number];

const getClubsFn = createServerFn({ method: "GET" })
	.validator(listSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize, search, sortBy, sortOrder } = parseListSearch(data);
		const { data: listData } = await apiServer.GET("/api/admin/clubs", {
			params: {
				query: {
					page: currentPage,
					perPage: pageSize,
					...(search ? { search } : {}),
					...(sortBy ? { sortBy: sortBy as "name" | "location" | "createdAt" } : {}),
					sortOrder,
				},
			},
		});
		return {
			clubs: (listData?.clubs || []) as AdminClub[],
			totalClubs: listData?.pagination.total || 0,
			pageSize,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/clubs/")({
	validateSearch: listSearchSchema,
	loaderDeps: ({ search }) => listDeps(search),
	loader: ({ deps }) => getClubsFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: ClubsPage,
});

function ClubsPage() {
	const t = useExtracted();
	const { clubs, totalClubs, pageSize } = Route.useLoaderData();

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("All clubs")}</h3>
			</div>
			<ClubsTable clubs={clubs} totalClubs={totalClubs} pageSize={pageSize} />
		</>
	);
}
