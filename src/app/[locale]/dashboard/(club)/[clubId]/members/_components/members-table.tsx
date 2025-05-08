"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { LeaveClubButton } from "@/components/leave-club-button";
import type { ClubMembership } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { removeMember } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members.action";
import { MembershipExtensionForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.form";
import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserCircle, Calendar, LogOut, UserMinus } from "lucide-react";

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
	const [membershipToExtend, setMembershipToExtend] = useState<ClubMembership & {
		userName: string;
		userAvatar: string | null;
	} | null>(null);

	const handleRemove = async (member: ClubMembership & { userName: string; }, clubId: string) => {
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
			// Check if membership expires within 7 days
			const sevenDaysFromNow = new Date();
			sevenDaysFromNow.setDate(today.getDate() + 7);

			if (new Date(membership.endDate) < sevenDaysFromNow) {
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
		<>
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
										? row.startDate.toLocaleDateString(locale, {
											day: "2-digit",
											month: "long",
											year: "numeric",
										})
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
										? row.endDate.toLocaleDateString(locale, {
											day: "2-digit",
											month: "long",
											year: "numeric",
										})
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
							components: (row) => {
								const isSelf = props.currentUserId === row.userId;
								const isClubOwner = row.role === "CLUB_OWNER";

								const items = [];

								// View profile action - for everyone
								items.push(
									<DropdownMenuItem key="profile" asChild>
										<Link href={`/users/${row.userSlug ?? row.userId}`} target="_blank">
											<UserCircle className="size-4 mr-2" />
											{t("profile")}
										</Link>
									</DropdownMenuItem>
								);

								// Leave club action - only for current user who isn't owner
								if (isSelf && !isClubOwner) {
									items.push(
										<DropdownMenuItem key="leave">
											<LeaveClubButton
												clubId={row.clubId}
												isClubOwner={false}
												renderAsMenuItem
												icon={<LogOut className="size-4 mr-2" />}
											/>
										</DropdownMenuItem>
									);
								}

								// Remove member action - can't remove yourself or the owner
								if (!isClubOwner && !isSelf) {
									items.push(
										<DropdownMenuItem
											key="remove"
											className="text-destructive focus:text-destructive"
											onClick={() => handleRemove(row, row.clubId)}
										>
											<UserMinus className="size-4 mr-2" />
											{t("removeMember")}
										</DropdownMenuItem>
									);
								}

								// Extend membership - for everyone
								items.push(
									<DropdownMenuItem
										key="extend"
										onClick={() => {
											setMembershipToExtend({
												...row,
												userName: row.userName,
												userAvatar: row.userAvatar
											});
										}}
									>
										<Calendar className="size-4 mr-2" />
										{t("extendMembership")}
									</DropdownMenuItem>
								);

								return items;
							},
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

			{membershipToExtend && (
				<MembershipExtensionForm
					clubId={membershipToExtend.clubId}
					membership={{
						...membershipToExtend,
						user: {
							name: membershipToExtend.userName,
							image: membershipToExtend.userAvatar,
						},
					}}
					variant="button"
					open={!!membershipToExtend}
					onOpenChange={(isOpen) => {
						if (!isOpen) {
							setMembershipToExtend(null);
						}
					}}
				/>
			)}
		</>
	);
}
