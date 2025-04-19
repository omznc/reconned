"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Event } from "@prisma/client";
import { Eye, Pen, Users } from "lucide-react";
import { useTranslations } from "next-intl";

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
					key: "visit",
					header: t("actions"),
					cellConfig: {
						variant: "custom",
						component: (_, item) => {
							const disabledAttendence =
								!userIsManager ||
								new Date() < new Date(item.dateRegistrationsClose) ||
								new Date() > new Date(item.dateEnd);
							return (
								<div className="flex gap-2">
									{userIsManager && (
										<>
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
													{t("attendence")}
												</Link>
											</Button>
											<Button variant={"outline"} asChild>
												<Link href={`/dashboard/${clubId}/events/create?id=${item.id}`}>
													<Pen className="size-4 mr-2" />
													{t("edit")}
												</Link>
											</Button>
										</>
									)}

									<Button asChild>
										<Link href={`/dashboard/${clubId}/events/${item.id}`}>
											<Eye className="size-4 mr-2" />
											{t("view")}
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
