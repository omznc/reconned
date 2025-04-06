"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { removeMember } from "./members.action";
import { LeaveClubButton } from "@/components/leave-club-button";
import type { ClubMembership } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface MembersTableProps {
	members: (ClubMembership & {
		userName: string;
		userCallsign: string | null;
		userAvatar: string | null;
		userSlug: string | null;
	})[];
	totalMembers: number;
	pageSize: number;
	currentUserId?: string;
}

export function MembersTable(props: MembersTableProps) {
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.members.membersTable");

	const handleRemove = async (
		member: ClubMembership & { userName: string; },
		clubId: string,
	) => {
		if (member.role === "CLUB_OWNER") {
			return;
		}

		const confirmed = await confirm({
			title: t("remove.title"),
			body: t("remove.body", { name: member.userName }),
			cancelButton: t("remove.cancel"),
			actionButton: t("remove.confirm"),
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
			toast.error(response?.data?.error || t("remove.error"));
			return;
		}

		toast.success(t("remove.success"));
	};

	return (
		<GenericDataTable
			data={props.members}
			totalPages={Math.ceil(props.totalMembers / props.pageSize)}
			searchPlaceholder={t("searchPlaceholder")}
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
					header: t("name"),
					sortable: true,
				},
				{
					key: "userCallsign",
					header: t("callsign"),
					sortable: true,
				},
				{
					key: "role",
					header: t("role"),
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							CLUB_OWNER: t("owner"),
							MANAGER: t("manager"),
							USER: t("member"),
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
					header: t("joinedDate"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("actions"),
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<div className="flex gap-2">
								<Button asChild variant="secondary" size="sm">
									<Link
										href={`/users/${row.userSlug ?? row.userId}`}
										target="_blank"
									>
										{t("profile")}
									</Link>
								</Button>
								{props.currentUserId === row.userId && row.role !== "CLUB_OWNER" && (
									<LeaveClubButton
										clubId={row.clubId}
										isClubOwner={false}
										variant="destructive"
										size="sm"
									/>
								)}
								{row.role !== "CLUB_OWNER" && props.currentUserId !== row.userId && (
									<div className="flex justify-end">
										<Button
											variant="destructive"
											size="sm"
											onClick={() => handleRemove(row, row.clubId)}
										>
											{t("removeMember")}
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
						{ label: t("allRoles"), value: "all" },
						{ label: t("owner"), value: "CLUB_OWNER" },
						{ label: t("manager"), value: "MANAGER" },
						{ label: t("member"), value: "USER" },
					],
				},
			]}
		/>
	);
}
