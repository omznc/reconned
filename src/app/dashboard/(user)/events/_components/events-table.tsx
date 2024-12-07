"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Event } from "@prisma/client";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
	return (
		<GenericDataTable
			data={events}
			totalPages={Math.ceil(totalEvents / pageSize)}
			searchPlaceholder="Pretraži susrete..."
			tableConfig={{
				dateFormat: "d. MMMM yyyy.",
				locale: "bs",
			}}
			columns={[
				{
					key: "name",
					header: "Naziv",
					sortable: true,
				},
				{
					key: "location",
					header: "Lokacija",
					sortable: true,
				},
				{
					key: "dateStart",
					header: "Datum početka",
					sortable: true,
				},
				{
					key: "dateRegistrationsClose",
					header: "Registracije do",
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
					header: "Klub",
					sortable: true,
				},
				{
					key: "visit",
					header: "Akcije",
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
