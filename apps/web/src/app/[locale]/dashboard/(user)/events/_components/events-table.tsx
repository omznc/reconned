"use client";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import { useExtracted } from "next-intl";
import { GenericDataTable } from "@/components/generic-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

function getEventStatus(dateStart: Date, dateEnd: Date) {
	const now = new Date();

	if (now < dateStart) {
		return { label: "Nadolazi", className: "bg-blue-100 text-blue-800" };
	}
	if (now > dateEnd) {
		return { label: "Prošao", className: "bg-gray-100 text-gray-800" };
	}
	return { label: "Trenutno", className: "bg-green-100 text-green-800" };
}

type EventsListResponse = ApiResponse<"/api/events", "get">;
type EventsListItem = EventsListResponse["events"][number];

interface EventsTableProps {
	events: EventsListItem[];
	totalEvents: number;
	pageSize: number;
}

export function EventsTable({ events, totalEvents, pageSize }: EventsTableProps) {
	const t = useExtracted();

	return (
		<GenericDataTable
			data={events}
			totalPages={Math.ceil(totalEvents / pageSize)}
			searchPlaceholder={t("Search events...")}
			columns={[
				{
					key: "name",
					header: t("Name"),
					sortable: true,
				},
				{
					key: "location",
					header: t("Location"),
					sortable: true,
				},
				{
					key: "dateStart",
					header: t("Start"),
					sortable: true,
				},
				{
					key: "dateRegistrationsClose",
					header: t("Closing applications"),
					sortable: true,
				},
				{
					key: "status",
					header: "Status",
					sortable: false,
					cellConfig: {
						variant: "custom",
						component: (_, row) => {
							const { label, className } = getEventStatus(row.dateStart, row.dateEnd);
							return <Badge className={cn("pointer-events-none", className)}>{label}</Badge>;
						},
					},
				},
				{
					key: "club.name",
					header: t("Club"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("Actions"),
					cellConfig: {
						variant: "custom",
						component: (_, item) => {
							return (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" className="h-8 w-8 p-0">
											<span className="sr-only">Otvori meni</span>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											<Link href={`/events/${item.id}`} target="_blank">
												<ExternalLink className="size-4 mr-2" />
												Posjeti
											</Link>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							);
						},
					},
				},
			]}
		/>
	);
}
