import { PlusCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { EventsTable } from "@/app/[locale]/dashboard/(club)/[clubId]/events/_components/events-table";
import { GenericDataTableSkeleton } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export async function EventsPageFetcher(props: PageProps<"/[locale]/dashboard/[clubId]/events">) {
	const { clubId } = await props.params;
	const { search, sortBy, sortOrder, page, perPage } = await props.searchParams;
	const currentPage = Math.max(1, Number(page ?? 1));
	const pageSize = perPage === "25" || perPage === "50" || perPage === "100" ? Number(perPage) : 25;

	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const { data } = await apiClient.GET("/api/clubs/{clubId}/events", {
		params: {
			path: {
				clubId,
			},
			query: {
				page: currentPage,
				perPage: pageSize,
				...(search ? { search: search as string } : {}),
				...(sortBy ? { sortBy: sortBy as "name" | "dateStart" } : {}),
				sortOrder: sortOrder === "asc" ? "asc" : "desc",
			},
		},
	});

	const events = data?.events ?? [];
	const totalEvents = data?.pagination.total ?? 0;

	return (
		<EventsTable
			events={events}
			totalEvents={totalEvents}
			clubId={clubId}
			pageSize={pageSize}
			userIsManager={user.managedClubs.includes(clubId) || Boolean(user.role === "admin")}
		/>
	);
}

export default async function Page(props: PageProps<"/[locale]/dashboard/[clubId]/events">) {
	const t = await getExtracted();
	const { clubId } = await props.params;
	const searchParams = await props.searchParams;

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
			<Suspense key={JSON.stringify(searchParams)} fallback={<GenericDataTableSkeleton />}>
				<EventsPageFetcher {...props} />
			</Suspense>
		</>
	);
}
