"use client";
import { Eye, Pen, Users } from "lucide-react";
import { useExtracted } from "next-intl";
import { GenericDataTable } from "@/components/generic-data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type ClubEventsResponse = ApiResponse<"/api/clubs/{clubId}/events", "get">;
type ClubEvent = ClubEventsResponse["events"][number];

interface EventsTableProps {
	events: ClubEvent[];
	totalEvents: number;
	clubId: string;
	pageSize: number;
	userIsManager: boolean;
}

export function EventsTable({ events, totalEvents, clubId, pageSize, userIsManager }: EventsTableProps) {
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
					key: "isPrivate",
					header: t("Type"),
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							true: t("Private"),
							false: t("Public"),
						},
						badgeVariants: {
							true: "bg-red-100 text-red-800",
							false: "bg-green-100 text-green-800",
						},
					},
				},
				{
					key: "_count.eventRegistration",
					header: t("Applications"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("Actions"),
					cellConfig: {
						variant: "custom",
						components: (item) => {
							const disabledAttendence =
								!userIsManager ||
								new Date() < new Date(item.dateRegistrationsClose) ||
								new Date() > new Date(item.dateEnd);

							const items = [];

							// Attendance action - only for managers and when enabled
							items.push(
								<DropdownMenuItem key="attendance" asChild disabled={disabledAttendence}>
									<Link href={`/dashboard/${clubId}/events/${item.id}/attendance`}>
										<Users className="size-4 mr-2" />
										{t("Presence")}
									</Link>
								</DropdownMenuItem>,
							);

							// Edit action - only for managers
							if (userIsManager) {
								items.push(
									<DropdownMenuItem key="edit" asChild>
										<Link href={`/dashboard/${clubId}/events/create?id=${item.id}`}>
											<Pen className="size-4 mr-2" />
											{t("Edit")}
										</Link>
									</DropdownMenuItem>,
								);
							}

							// View action - for everyone
							items.push(
								<DropdownMenuItem key="view" asChild>
									<Link href={`/dashboard/${clubId}/events/${item.id}`}>
										<Eye className="size-4 mr-2" />
										{t("View")}
									</Link>
								</DropdownMenuItem>,
							);

							return items;
						},
					},
				},
			]}
		/>
	);
}
