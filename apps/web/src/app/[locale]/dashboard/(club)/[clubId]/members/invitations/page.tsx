import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { InvitationsForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations.form";
import { InvitationsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/members/invitations/_components/invitations-table";
import { ErrorPage } from "@/components/error-page";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export async function InvitationsPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/members/invitations">) {
	const params = await props.params;
	const searchParams = await props.searchParams;
	const user = await isAuthenticated();
	const t = await getExtracted();

	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	// Check if user is a manager or owner of this club
	const { data: membershipData, error: membershipError } = await apiServer.GET("/api/clubs/{id}/membership", {
		params: { path: { id: params.clubId } },
	});

	if (
		membershipError ||
		!membershipData?.membership ||
		(membershipData.membership.role !== "MANAGER" && membershipData.membership.role !== "CLUB_OWNER")
	) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const page = Math.max(1, Number(searchParams.page || 1));
	const pageSize =
		searchParams.perPage === "25" || searchParams.perPage === "50" || searchParams.perPage === "100"
			? Number(searchParams.perPage)
			: 25;

	// Fetch invitations from backend
	const { data, error } = await apiServer.GET("/api/clubs/{id}/invites", {
		params: {
			path: { id: params.clubId },
			query: {
				page,
				perPage: pageSize,
				search: searchParams.search as string | undefined,
				status:
					searchParams.status && searchParams.status !== "all" ? (searchParams.status as string) : undefined,
			},
		},
	});

	if (error || !data) {
		return <div>Failed to load invitations</div>;
	}

	return <InvitationsTable invites={data.invites} totalPages={data.pagination.totalPages} />;
}

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/members/invitations">) {
	const searchParams = await props.searchParams;

	return (
		<>
			<InvitationsForm />
			<hr />
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<InvitationsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
