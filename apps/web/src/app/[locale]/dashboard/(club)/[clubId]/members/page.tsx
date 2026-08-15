import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { MembersTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export async function MembersPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/members">) {
	const [params, { search, role, status, sortBy, sortOrder, page, perPage }] = await Promise.all([
		props.params,
		props.searchParams,
	]);

	const { clubId } = params;
	const currentPage = Math.max(1, Number(page || 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const user = await isAuthenticated();

	// The viewer's own role comes from its own lookup: filtering the list to archived members
	// would otherwise drop their row and silently take their manager actions away.
	const [{ data, error }, { data: membershipData }] = await Promise.all([
		apiServer.GET("/api/clubs/{id}/members", {
			params: {
				path: { id: clubId },
				query: {
					page: currentPage,
					perPage: pageSize,
					search: search as string | undefined,
					role: role as "all" | "USER" | "MANAGER" | "CLUB_OWNER" | undefined,
					status: status as "ACTIVE" | "ARCHIVED" | "ALL" | undefined,
					sortBy: sortBy as "userName" | "userCallsign" | "role" | "createdAt" | undefined,
					sortOrder: sortOrder as "asc" | "desc" | undefined,
				},
			},
		}),
		apiServer.GET("/api/clubs/{id}/membership", {
			params: { path: { id: clubId } },
		}),
	]);

	if (error || !data) {
		return <div>Failed to load members</div>;
	}

	const currentUserRole = membershipData?.membership?.role;

	return (
		<MembersTable
			members={data.members}
			totalMembers={data.total}
			pageSize={pageSize}
			currentUserId={user?.id}
			currentUserRole={currentUserRole}
		/>
	);
}

export default async function MembersPage(props: PageProps<"/[locale]/dashboard/[clubId]/members">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	return (
		<>
			<div>
				<h3 className="text-lg font-semibold">{t("All members")}</h3>
			</div>
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<MembersPageFetcher {...props} />
			</Suspense>
		</>
	);
}
