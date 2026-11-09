import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { asWire, listDeps, listSearchSchema, parseListSearch } from "@/lib/list-search";
import { EventsTable } from "@/routes/{-$locale}/dashboard/events/-components/events-table";

const getMyEventsFn = createServerFn({ method: "GET" })
	.validator(listSearchSchema)
	.handler(async ({ data }) => {
		const { currentPage, pageSize, search, sortBy, sortOrder } = parseListSearch(data);
		const { data: eventsData } = await apiServer.GET("/api/events", {
			params: {
				query: {
					page: currentPage,
					perPage: pageSize,
					...(search ? { search } : {}),
					...(sortBy ? { sortBy: sortBy as "name" | "dateStart" } : {}),
					sortOrder,
					filter: "mine",
				},
			},
		});
		return {
			events: asWire(eventsData?.events || []),
			totalEvents: eventsData?.pagination.total || 0,
			pageSize,
		};
	});

export const Route = createFileRoute("/{-$locale}/dashboard/events/")({
	validateSearch: listSearchSchema,
	loaderDeps: ({ search }) => listDeps(search),
	loader: ({ deps }) => getMyEventsFn({ data: deps }),
	pendingComponent: GenericDataTableSkeleton,
	notFoundComponent: NotFoundPage,
	component: EventsPage,
});

function EventsPage() {
	const t = useExtracted();
	const { events, totalEvents, pageSize } = Route.useLoaderData();

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("My events")}</h3>
			</div>
			<EventsTable events={events} totalEvents={totalEvents} pageSize={pageSize} />
		</>
	);
}
