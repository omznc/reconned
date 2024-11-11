"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Event } from "@prisma/client";
import { Eye, Pen } from "lucide-react";

interface EventsTableProps {
	events: (Event & {
		_count: {
			invites: number;
			registrations: number;
		};
	})[];
	totalEvents: number;
	clubId: string;
	pageSize: number;
}

export function EventsTable({
	events,
	totalEvents,
	clubId,
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
					key: "isPrivate",
					header: "Tip",
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							true: "Privatni",
							false: "Javni",
						},
						badgeVariants: {
							true: "bg-red-100 text-red-800",
							false: "bg-green-100 text-green-800",
						},
					},
				},
				{
					key: "_count.invites",
					header: "Pozivnice",
					sortable: true,
				},
				{
					key: "_count.registrations",
					header: "Prijave",
					sortable: true,
				},
				{
					key: "visit",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, item) => (
							<div className="flex gap-2">
								<Button asChild>
									<Link href={`/dashboard/${clubId}/events/${item.id}`}>
										<Eye className="size-4 mr-2" />
										Posjeti
									</Link>
								</Button>
								<Button asChild>
									<Link
										href={`/dashboard/${clubId}/events/create?id=${item.id}`}
									>
										<Pen className="size-4 mr-2" />
										Uredi
									</Link>
								</Button>
							</div>
						),
					},
				},
			]}
		/>
	);
}
