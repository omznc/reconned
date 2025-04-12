"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { LeaveClubButton } from "@/components/leave-club-button";
import type { ClubMembership } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { removeMember } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members.action";
import { MembershipExtensionForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.form";

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
	const locale = useLocale();

	const handleRemove = async (
		member: ClubMembership & { userName: string },
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

	const getMembershipStatus = (membership: ClubMembership) => {
		const today = new Date();

		if (!membership.startDate && !membership.endDate) {
			return {
				label: t("membershipStatus.unlimited"),
				variant: "default",
			} as const;
		}

		if (membership.endDate && new Date(membership.endDate) < today) {
			return {
				label: t("membershipStatus.expired"),
				variant: "outline",
			} as const;
		}

		if (membership.endDate) {
			// Check if membership expires within 30 days
			const thirtyDaysFromNow = new Date();
			thirtyDaysFromNow.setDate(today.getDate() + 30);

			if (new Date(membership.endDate) < thirtyDaysFromNow) {
				return {
					label: t("membershipStatus.expiringSoon"),
					variant: "secondary",
				} as const;
			}

			return {
				label: t("membershipStatus.active"),
				variant: "default",
			} as const;
		}

		return {
			label: t("membershipStatus.active"),
			variant: "default",
		} as const;
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
					key: "membershipStatus",
					header: t("membershipStatus.title"),
					sortable: false,
					cellConfig: {
						variant: "custom",
						component: (_, row) => {
							const status = getMembershipStatus(row);
							return (
								<Badge className="px-2 py-1 text-xs" variant={status.variant}>
									{status.label}
								</Badge>
							);
						},
					},
				},
				{
					key: "startDate",
					header: t("startDate"),
					sortable: true,
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<span>
								{row.startDate
									? row.startDate.toLocaleDateString(locale)
									: t("notSet")}
							</span>
						),
					},
				},
				{
					key: "endDate",
					header: t("endDate"),
					sortable: true,
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<span>
								{row.endDate
									? row.endDate.toLocaleDateString(locale)
									: t("unlimited")}
							</span>
						),
					},
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
								<MembershipExtensionForm
									clubId={row.clubId}
									membership={{
										...row,
										user: {
											name: row.userName,
											image: row.userAvatar,
										},
									}}
									variant="button"
								/>
								{props.currentUserId === row.userId &&
									row.role !== "CLUB_OWNER" && (
										<LeaveClubButton
											clubId={row.clubId}
											isClubOwner={false}
											variant="destructive"
											size="sm"
										/>
									)}
								{row.role !== "CLUB_OWNER" &&
									props.currentUserId !== row.userId && (
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
