"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Event } from "@prisma/client";
import { Eye, Pen, Users } from "lucide-react";

interface EventsTableProps {
	events: (Event & {
		_count: {
			eventRegistration: number;
		};
	})[];
	totalEvents: number;
	clubId: string;
	pageSize: number;
	userIsManager: boolean;
}

export function EventsTable({
	events,
	totalEvents,
	clubId,
	pageSize,
	userIsManager,
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
					key: "_count.eventRegistration",
					header: "Prijave",
					sortable: true,
				},
				{
					key: "visit",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, item) => {
							const disabledAttendence =
								!userIsManager ||
								new Date() < new Date(item.dateRegistrationsClose) ||
								new Date() > new Date(item.dateEnd);
							return (
								<div className="flex gap-2">
									<Button
										variant={"outline"}
										disabled={disabledAttendence}
										asChild={!disabledAttendence}
									>
										<Link
											className="flex items-center gap-2"
											href={`/dashboard/${clubId}/events/${item.id}/attendance`}
										>
											<Users className="size-4" />
											Prisustvo
										</Link>
									</Button>
									<Button variant={"outline"} asChild>
										<Link
											href={`/dashboard/${clubId}/events/create?id=${item.id}`}
										>
											<Pen className="size-4 mr-2" />
											Uredi
										</Link>
									</Button>
									<Button asChild>
										<Link href={`/dashboard/${clubId}/events/${item.id}`}>
											<Eye className="size-4 mr-2" />
											Posjeti
										</Link>
									</Button>
								</div>
							);
						},
					},
				},
			]}
		/>
	);
}
