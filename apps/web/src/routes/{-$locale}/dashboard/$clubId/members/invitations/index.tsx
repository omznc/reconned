import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { NoAccessPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { parsePaging, tableSearchSchema } from "@/routes/{-$locale}/dashboard/$clubId/-lib/table-search";
import { InvitationsForm } from "@/routes/{-$locale}/dashboard/$clubId/members/invitations/-components/invitations.form";
import { InvitationsTable } from "@/routes/{-$locale}/dashboard/$clubId/members/invitations/-components/invitations-table";

const getInvitesFn = createServerFn({ method: "GET" })
	.validator(tableSearchSchema.extend({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parsePaging(data.page, data.perPage);
		const { data: invites, error } = await apiServer.GET("/api/clubs/{id}/invites", {
			params: {
				path: { id: data.clubId },
				query: {
					page: currentPage,
					perPage: pageSize,
					search: data.search,
					status: data.status && data.status !== "all" ? data.status : undefined,
				},
			},
		});
		return error || !invites ? null : { invites: invites.invites, totalPages: invites.pagination.totalPages };
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/members/invitations/")({
	validateSearch: tableSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: async ({ params, deps, context }) => {
		// Admins who are not in the club are refused here, as before.
		if (context.access.role !== "MANAGER" && context.access.role !== "CLUB_OWNER") {
			return { kind: "forbidden" as const };
		}
		const page = await getInvitesFn({ data: { clubId: params.clubId, ...deps.search } });
		return page ? { kind: "ok" as const, ...page } : { kind: "failed" as const };
	},
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: InvitationsPage,
});

function InvitationsPage() {
	const page = Route.useLoaderData();

	if (page.kind === "forbidden") {
		return <NoAccessPage />;
	}
	return (
		<>
			<InvitationsForm />
			<hr />
			{page.kind === "ok" ? (
				<InvitationsTable invites={page.invites} totalPages={page.totalPages} />
			) : (
				<div>Failed to load invitations</div>
			)}
		</>
	);
}
