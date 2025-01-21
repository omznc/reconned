"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { removeMember } from "./members.action";
import type { ClubMembership } from "@prisma/client";
import Link from "next/link";

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
	const confirm = useConfirm();

	const handleRemove = async (
		member: ClubMembership & { userName: string },
		clubId: string,
	) => {
		if (member.role === "CLUB_OWNER") {
			return;
		}

		const confirmed = await confirm({
			title: "Ukloni člana",
			body: `Da li ste sigurni da želite ukloniti ${member.userName} iz kluba?`,
			cancelButton: "Odustani",
			actionButton: "Ukloni",
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		const response = await removeMember({
			memberId: member.id,
			clubId: clubId,
		});

		if (!response?.data?.success) {
			toast.error(response?.data?.error || "Neuspjelo uklanjanje člana.");
			return;
		}

		toast.success("Član je uspješno uklonjen iz kluba.");
	};

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
				{
					key: "actions",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<div className="flex gap-2">
								<Button asChild variant="secondary" size="sm">
									<Link href={`/users/${row.userId}`} target="_blank">
										Profil
									</Link>
								</Button>
								{row.role !== "CLUB_OWNER" && (
									<div className="flex justify-end">
										<Button
											variant="destructive"
											size="sm"
											onClick={() => handleRemove(row, row.clubId)}
										>
											Ukloni
										</Button>
									</div>
								)}
							</div>
						),
					},
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
