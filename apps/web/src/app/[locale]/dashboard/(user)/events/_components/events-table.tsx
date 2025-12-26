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
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { cn } from "@/lib/utils";

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
							const now = new Date();
							const dateStart = new Date(row.dateStart);
							const dateEnd = new Date(row.dateEnd);

							let label: string;
							let className: string;

							if (now < dateStart) {
								label = t("Upcoming");
								className = "bg-blue-100 text-blue-800";
							} else if (now > dateEnd) {
								label = t("Finished");
								className = "bg-gray-100 text-gray-800";
							} else {
								label = t("Current");
								className = "bg-green-100 text-green-800";
							}

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
											<span className="sr-only">{t("Open menu")}</span>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem asChild>
											<Link href={`/events/${item.id}`} target="_blank">
												<ExternalLink className="size-4 mr-2" />
												{t("Visit")}
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
