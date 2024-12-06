"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { ClubMembership } from "@prisma/client";

interface MembersTableProps {
	members: (ClubMembership & {
		userName: string;
		userCallsign: string | null;
		userAvatar: string | null;
	})[];
	totalMembers: number;
	pageSize: number;
}

export function MembersTable(props: MembersTableProps) {
	return (
		<GenericDataTable
			data={props.members}
			totalPages={Math.ceil(props.totalMembers / props.pageSize)}
			searchPlaceholder="Pretraži članove..."
			tableConfig={{
				dateFormat: "d. MMMM yyyy.",
				locale: "bs",
			}}
			columns={[
				{
					key: "avatar",
					header: "Avatar",
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<Avatar className="h-8 w-8">
								<AvatarImage src={row?.userAvatar ?? undefined} alt="Avatar" />
								<AvatarFallback>
									{row.userName
										.split(" ")
										.map((name) => name[0])
										.join("")}
								</AvatarFallback>
							</Avatar>
						),
					},
				},
				{
					key: "userName",
					header: "Ime",
					sortable: true,
				},
				{
					key: "userCallsign",
					header: "Callsign",
					sortable: true,
				},
				{
					key: "role",
					header: "Uloga",
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							CLUB_OWNER: "Vlasnik",
							MANAGER: "Menadžer",
							USER: "Član",
						},
						badgeVariants: {
							CLUB_OWNER: "bg-red-100 text-red-800",
							MANAGER: "bg-blue-100 text-blue-800",
							MEMBER: "bg-gray-100 text-gray-800",
						},
					},
				},
				{
					key: "createdAt",
					header: "Datum pridruživanja",
					sortable: true,
				},
			]}
			filters={[
				{
					key: "role",
					label: "Filter po ulozi",
					options: [
						{ label: "Sve uloge", value: "all" },
						{ label: "Vlasnik", value: "CLUB_OWNER" },
						{ label: "Menadžer", value: "MANAGER" },
						{ label: "Član", value: "USER" },
					],
				},
			]}
		/>
	);
}
