import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api.ts";
import type { ApiResponse } from "@/lib/api/api-type-helpers.ts";
import { ClubsSheet } from "./_components/clubs.sheet.tsx";
import { ClubsTable } from "./_components/clubs.table.tsx";

type AdminClub = ApiResponse<"/api/admin/clubs", "get">["clubs"][number];

export async function ClubsPageFetcher(props: PageProps<"/[locale]/dashboard/admin/clubs">) {
	const { search, sortBy, sortOrder, page, clubId, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data: listData } = await apiServer.GET("/api/admin/clubs", {
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

	const clubs = (listData?.clubs ?? []) as AdminClub[];
	const totalClubs = listData?.pagination.total ?? 0;

	const selectedClub = clubId
		? (
				await apiServer.GET("/api/admin/clubs/{id}", {
					params: {
						path: { id: clubId as string },
					},
				})
			).data
		: undefined;

	return (
		<>
			<ClubsSheet selectedClub={selectedClub ?? undefined} />
			<ClubsTable clubs={clubs} totalClubs={totalClubs} pageSize={pageSize} />
		</>
	);
}

export default async function ClubsPage(props: PageProps<"/[locale]/dashboard/admin/clubs">) {
	const t = await getExtracted();
	const params = await props.params;

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("All clubs")}</h3>
			</div>
			<Suspense key={JSON.stringify(params)} fallback={<GenericDataTableSkeleton />}>
				<ClubsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
