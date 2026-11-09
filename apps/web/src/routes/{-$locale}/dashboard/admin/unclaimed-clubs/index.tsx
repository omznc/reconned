import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { listDeps, listSearchSchema, parseListSearch } from "@/lib/list-search";
import { UnclaimedClubsTable } from "@/routes/{-$locale}/dashboard/admin/unclaimed-clubs/-components/unclaimed-clubs.table";

type AdminUnclaimed = ApiResponse<"/api/admin/unclaimed-clubs", "get">["clubs"][number];

const getUnclaimedClubsFn = createServerFn({ method: "GET" })
	.validator(listSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize, search, sortBy, sortOrder } = parseListSearch(data);
		const { data: listData } = await apiServer.GET("/api/admin/unclaimed-clubs", {
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
			clubs: (listData?.clubs || []) as AdminUnclaimed[],
			totalClubs: listData?.pagination.total || 0,
			pageSize,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/admin/unclaimed-clubs/")({
	validateSearch: listSearchSchema,
	loaderDeps: ({ search }) => listDeps(search),
	loader: ({ deps }) => getUnclaimedClubsFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: UnclaimedClubsPage,
});

function UnclaimedClubsPage() {
	const t = useExtracted();
	const { clubs, totalClubs, pageSize } = Route.useLoaderData();

	return (
		<>
			<div className="flex justify-between items-center mb-4">
				<h3 className="text-lg font-semibold">{t("Unclaimed clubs")}</h3>
				<Button asChild>
					<Link href="/dashboard/admin/unclaimed-clubs/create">
						<Plus className="size-4" />
						{t("Create unclaimed club")}
					</Link>
				</Button>
			</div>
			<UnclaimedClubsTable clubs={clubs} totalClubs={totalClubs} pageSize={pageSize} />
		</>
	);
}
