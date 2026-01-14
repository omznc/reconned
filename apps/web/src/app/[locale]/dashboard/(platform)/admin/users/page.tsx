import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { UserTable } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUser = ApiResponse<"/api/admin/users", "get">["users"][number];

export async function UsersPageFetcher(props: PageProps<"/[locale]/dashboard/admin/users">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, perPage } = searchParams;
	const currentPage = Math.max(1, Number(page || 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const { data: listData } = await apiServer.GET("/api/admin/users", {
		params: {
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(sortBy ? { sortBy: sortBy as "name" | "email" | "callsign" | "createdAt" } : {}),
				sortOrder: sortOrder === "asc" ? "asc" : "desc",
			},
		},
	});

	const users = (listData?.users || []) as AdminUser[];
	const totalUsers = listData?.pagination.total || 0;

	return <UserTable users={users} totalUsers={totalUsers} pageSize={pageSize} />;
}

export default async function UsersPage(props: PageProps<"/[locale]/dashboard/admin/users">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	// Create a key that only includes parameters that affect data fetching
	const dataKey = JSON.stringify({
		search: searchParams.search,
		sortBy: searchParams.sortBy,
		sortOrder: searchParams.sortOrder,
		page: searchParams.page,
		perPage: searchParams.perPage,
	});

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("All members")}</h3>
			</div>
			<Suspense key={dataKey} fallback={<GenericDataTableSkeleton />}>
				<UsersPageFetcher {...props} />
			</Suspense>
		</>
	);
}
