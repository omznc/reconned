import { Plus } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiClient, { type ApiResponse } from "@/lib/api";
import { UnclaimedClubsSheet } from "./_components/unclaimed-clubs.sheet.tsx";
import { UnclaimedClubsTable } from "./_components/unclaimed-clubs.table.tsx";

type AdminUnclaimedList = ApiResponse<"/api/admin/unclaimed-clubs", "get">;
type AdminUnclaimed = AdminUnclaimedList["clubs"][number];

export async function UnclaimedClubsPageFetcher(props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs">) {
	const { search, sortBy, sortOrder, page, clubId, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data: listData } = await apiClient.GET("/api/admin/unclaimed-clubs", {
		params: {
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(sortBy ? { sortBy: sortBy as "name" | "location" | "createdAt" } : {}),
				sortOrder: sortOrder === "asc" ? "asc" : "desc",
			},
		},
	});

	const clubs = (listData?.clubs ?? []) as AdminUnclaimed[];
	const totalClubs = listData?.pagination.total ?? 0;

	const selectedClub = clubId
		? (
				await apiClient.GET("/api/admin/unclaimed-clubs/{id}", {
					params: {
						path: { id: clubId as string },
					},
				})
			).data
		: undefined;

	return (
		<>
			<UnclaimedClubsSheet selectedClub={selectedClub ?? undefined} />
			<UnclaimedClubsTable clubs={clubs} totalClubs={totalClubs} pageSize={pageSize} />
		</>
	);
}

export default async function UnclaimedClubsPage(props: PageProps<"/[locale]/dashboard/admin/unclaimed-clubs">) {
	const params = await props.params;
	const t = await getExtracted();

	return (
		<>
			<div className="flex justify-between items-center mb-4">
				<h3 className="text-lg font-semibold">{t("Unclaimed clubs")}</h3>
				<Button asChild>
					<Link href="/dashboard/admin/unclaimed-clubs/create">
						<Plus className="size-4 mr-2" />
						{t("Create unclaimed club")}
					</Link>
				</Button>
			</div>
			<Suspense key={JSON.stringify(params)} fallback={<GenericDataTableSkeleton />}>
				<UnclaimedClubsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
