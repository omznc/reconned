import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EventsTable } from "@/app/[locale]/dashboard/(user)/events/_components/events-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export async function EventsPageFetcher(props: PageProps<"/[locale]/dashboard/events">) {
	const user = await isAuthenticated();
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	if (!user) {
		return notFound();
	}

	const { data } = await apiServer.GET("/api/events", {
		params: {
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(sortBy ? { sortBy: sortBy as "name" | "dateStart" } : {}),
				sortOrder: sortOrder === "asc" ? "asc" : "desc",
				filter: "mine",
			},
		},
	});

	const events = data?.events ?? [];
	const totalEvents = data?.pagination.total ?? 0;

	return <EventsTable events={events} totalEvents={totalEvents} pageSize={pageSize} />;
}

export default async function Page(props: PageProps<"/[locale]/dashboard/events">) {
	const t = await getExtracted();
	const searchParams = await props.searchParams;

	return (
		<>
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">{t("My events")}</h3>
			</div>
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<EventsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
