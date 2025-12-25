import { Suspense } from "react";
import { UserSheet } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-sheet";
import { UserTable } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUser = ApiResponse<"/api/admin/users", "get">["users"][number];

export async function UsersPageFetcher(props: PageProps<"/[locale]/dashboard/admin/users">) {
	const searchParams = await props.searchParams;
	const { search, sortBy, sortOrder, page, userId, perPage } = searchParams;
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

	const selectedUser = userId
		? (
				await apiServer.GET("/api/admin/users/{id}", {
					params: {
						path: { id: userId as string },
					},
				})
			).data
		: undefined;

	return (
		<>
			<UserSheet user={selectedUser || undefined} />
			<UserTable users={users} totalUsers={totalUsers} pageSize={pageSize} />
		</>
	);
}

export default async function UsersPage(props: PageProps<"/[locale]/dashboard/admin/users">) {
	const searchParams = await props.searchParams;
	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">Svi članovi</h3>
			</div>
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<UsersPageFetcher {...props} />
			</Suspense>
		</>
	);
}
