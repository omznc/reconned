"use client";

import type { Event } from "@generated/client";
import { ArrowUpRight, ExternalLink, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
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

interface EventsTableProps {
	events: (Event & {
		_count: {
			eventRegistration: number;
		};
		club: {
			name: string;
		};
	})[];
	totalEvents: number;
	pageSize: number;
}

export function EventsTable({ events, totalEvents, pageSize }: EventsTableProps) {
	const t = useTranslations();

	return (
		<GenericDataTable
			data={events}
			totalPages={Math.ceil(totalEvents / pageSize)}
			searchPlaceholder={t("dashboard.events.search")}
			columns={[
				{
					key: "name",
					header: t("dashboard.events.name"),
					sortable: true,
				},
				{
					key: "location",
					header: t("dashboard.events.location"),
					sortable: true,
				},
				{
					key: "dateStart",
					header: t("dashboard.events.dateStart"),
					sortable: true,
				},
				{
					key: "dateRegistrationsClose",
					header: t("dashboard.events.dateRegistrationsClose"),
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
							return <Badge className={`pointer-events-none ${className}`}>{label}</Badge>;
						},
					},
				},
				{
					key: "club.name",
					header: t("dashboard.events.clubName"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("dashboard.events.actions"),
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
