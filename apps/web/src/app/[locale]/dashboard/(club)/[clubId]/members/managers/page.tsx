import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { AddManagerForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/manager.form";
import { ManagersTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/managers/_components/managers-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiClient from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export async function ManagersPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/members/managers">) {
	const params = await props.params;
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const user = await isAuthenticated();

	if (!user) {
		return notFound();
	}

	// Check if user is a manager or owner of this club
	const { data: clubData, error: clubError } = await apiClient.GET("/api/clubs/{id}", {
		params: { path: { id: params.clubId } },
	});

	if (clubError || !clubData) {
		return notFound();
	}

	// Verify user is a manager or owner
	const { data: membershipData, error: membershipError } = await apiClient.GET("/api/clubs/{id}/membership", {
		params: { path: { id: params.clubId } },
	});

	if (
		membershipError ||
		!membershipData?.membership ||
		(membershipData.membership.role !== "MANAGER" && membershipData.membership.role !== "CLUB_OWNER")
	) {
		return notFound();
	}

	// Fetch managers from backend - use the members endpoint with role filter
	const { data, error } = await apiClient.GET("/api/clubs/{id}/members", {
		params: {
			path: { id: params.clubId },
			query: {
				page: currentPage,
				perPage: pageSize,
				search: search as string | undefined,
				role: "MANAGER", // This will filter for MANAGER and CLUB_OWNER
				sortBy: sortBy as "userName" | "userCallsign" | "role" | "createdAt" | undefined,
				sortOrder: sortOrder as "asc" | "desc" | undefined,
			},
		},
	});

	if (error || !data) {
		return <div>Failed to load managers</div>;
	}

	// Filter to include only MANAGER and CLUB_OWNER roles
	const managers = data.members.filter((member) => member.role === "MANAGER" || member.role === "CLUB_OWNER");

	return <ManagersTable managers={managers} totalManagers={data.total} pageSize={pageSize} />;
}

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/members/managers">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold mb-4">{t("Managers")}</h2>
				<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
					<ManagersPageFetcher {...props} />
				</Suspense>
			</div>
			<AddManagerForm />
		</div>
	);
}
