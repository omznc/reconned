import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { PlusCircle } from "lucide-react";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { serializable } from "@/routes/{-$locale}/dashboard/$clubId/-lib/serializable";
import { parsePaging, tableSearchSchema } from "@/routes/{-$locale}/dashboard/$clubId/-lib/table-search";
import { EventsTable } from "@/routes/{-$locale}/dashboard/$clubId/events/-components/events-table";

const getEventsFn = createServerFn({ method: "GET" })
	.validator(tableSearchSchema.extend({ clubId: z.string() }))
	.handler(async ({ data }) => {
		const { currentPage, pageSize } = parsePaging(data.page, data.perPage);
		const { data: events } = await apiServer.GET("/api/clubs/{clubId}/events", {
			params: {
				path: { clubId: data.clubId },
				query: {
					page: currentPage,
					perPage: pageSize,
					...(data.search ? { search: data.search } : {}),
					...(data.sortBy ? { sortBy: data.sortBy as "name" | "dateStart" } : {}),
					sortOrder: data.sortOrder === "asc" ? "asc" : "desc",
				},
			},
		});
		return serializable({ pageSize, events: events?.events || [], totalEvents: events?.pagination.total || 0 });
	});

export const Route = createFileRoute("/{-$locale}/dashboard/$clubId/events/")({
	validateSearch: tableSearchSchema,
	loaderDeps: ({ search }) => ({ search }),
	loader: ({ params, deps }) => getEventsFn({ data: { clubId: params.clubId, ...deps.search } }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: EventsPage,
});

function EventsPage() {
	const t = useExtracted();
	const { clubId } = Route.useParams();
	const { access } = Route.useRouteContext();
	const { events, totalEvents, pageSize } = Route.useLoaderData();

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("All events")}</h3>
				<Button asChild>
					<Link href={`/dashboard/${clubId}/events/create`}>
						<PlusCircle className="size-4 mr-2" />
						{t("Create an event")}
					</Link>
				</Button>
			</div>
			<EventsTable
				events={events}
				totalEvents={totalEvents}
				clubId={clubId}
				pageSize={pageSize}
				userIsManager={access.isManager}
			/>
		</>
	);
}
