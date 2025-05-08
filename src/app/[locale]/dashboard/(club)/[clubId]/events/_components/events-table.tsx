"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Event } from "@prisma/client";
import { Eye, Pen, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

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

export function EventsTable({ events, totalEvents, clubId, pageSize, userIsManager }: EventsTableProps) {
	const t = useTranslations("dashboard.club.events");
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
					key: "isPrivate",
					header: t("type"),
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							true: t("private"),
							false: t("public"),
						},
						badgeVariants: {
							true: "bg-red-100 text-red-800",
							false: "bg-green-100 text-green-800",
						},
					},
				},
				{
					key: "_count.eventRegistration",
					header: t("registrations"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("actions"),
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
										{t("attendence")}
									</Link>
								</DropdownMenuItem>
							);

							// Edit action - only for managers
							if (userIsManager) {
								items.push(
									<DropdownMenuItem key="edit" asChild>
										<Link href={`/dashboard/${clubId}/events/create?id=${item.id}`}>
											<Pen className="size-4 mr-2" />
											{t("edit")}
										</Link>
									</DropdownMenuItem>
								);
							}

							// View action - for everyone
							items.push(
								<DropdownMenuItem key="view" asChild>
									<Link href={`/dashboard/${clubId}/events/${item.id}`}>
										<Eye className="size-4 mr-2" />
										{t("view")}
									</Link>
								</DropdownMenuItem>
							);

							return items;
						},
					},
				},
			]}
		/>
	);
}
