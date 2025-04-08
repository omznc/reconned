"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Event } from "@prisma/client";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "next-intl";

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

export function EventsTable({
	events,
	totalEvents,
	pageSize,
}: EventsTableProps) {
	const t = useTranslations("dashboard.events");

	return (
		<GenericDataTable
			data={events}
			totalPages={Math.ceil(totalEvents / pageSize)}
			searchPlaceholder={t("search")}
			columns={[
				{
					key: "name",
					header: t("name"),
					sortable: true,
				},
				{
					key: "location",
					header: t("location"),
					sortable: true,
				},
				{
					key: "dateStart",
					header: t("dateStart"),
					sortable: true,
				},
				{
					key: "dateRegistrationsClose",
					header: t("dateRegistrationsClose"),
					sortable: true,
				},
				{
					key: "status",
					header: "Status",
					sortable: false,
					cellConfig: {
						variant: "custom",
						component: (_, row) => {
							const { label, className } = getEventStatus(
								row.dateStart,
								row.dateEnd,
							);
							return (
								<Badge className={`pointer-events-none ${className}`}>
									{label}
								</Badge>
							);
						},
					},
				},
				{
					key: "club.name",
					header: t("clubName"),
					sortable: true,
				},
				{
					key: "visit",
					header: t("actions"),
					cellConfig: {
						variant: "custom",
						component: (_, item) => (
							<Button asChild>
								<Link href={`/events/${item.id}`} target="_blank">
									Posjeti
									<ArrowUpRight className="size-4 ml-2" />
								</Link>
							</Button>
						),
					},
				},
			]}
		/>
	);
}
