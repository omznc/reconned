"use client";

import { Calendar, LogOut, UserCircle, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted, useLocale } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { MembershipExtensionForm } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/membership-extension.form";
import { GenericDataTable } from "@/components/generic-data-table";
import { LeaveClubButton } from "@/components/leave-club-button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api";
import type { ClubMembership } from "@/lib/api-type-helpers";

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
	const t = useExtracted();
	const locale = useLocale();
	const router = useRouter();
	const [membershipToExtend, setMembershipToExtend] = useState<
		| (ClubMembership & {
				userName: string;
				userAvatar: string | null;
		  })
		| null
	>(null);

	const handleRemove = async (member: ClubMembership & { userName: string }, clubId: string) => {
		if (member.role === "CLUB_OWNER") {
			return;
		}

		const confirmed = await confirm({
			title: t("Are you sure?"),
			body: t("Are you sure you want to remove {name} from the club?", { name: member.userName }),
			cancelButton: t("Cancel"),
			actionButton: t("Confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		try {
			const { error } = await apiClient.DELETE("/api/clubs/{id}/members/{memberId}", {
				params: {
					path: {
						id: clubId,
						memberId: member.id,
					},
				},
			});

			if (error) {
				toast.error(error.error || t("An error occurred while removing the member"));
				return;
			}

			toast.success(t("Member successfully removed"));
			router.refresh();
		} catch {
			toast.error(t("An error occurred while removing the member"));
		}
	};

	const getMembershipStatus = (membership: ClubMembership) => {
		const today = new Date();

		if (!membership.startDate && !membership.endDate) {
			return {
				label: t("Unlimited"),
				variant: "default",
			} as const;
		}

		if (membership.endDate && new Date(membership.endDate) < today) {
			return {
				label: t("Expired"),
				variant: "outline",
			} as const;
		}

		if (membership.endDate) {
			// Check if membership expires within 7 days
			const sevenDaysFromNow = new Date();
			sevenDaysFromNow.setDate(today.getDate() + 7);

			if (new Date(membership.endDate) < sevenDaysFromNow) {
				return {
					label: t("Expiring soon"),
					variant: "secondary",
				} as const;
			}

			return {
				label: t("Active"),
				variant: "default",
			} as const;
		}

		return {
			label: t("Active"),
			variant: "default",
		} as const;
	};

	return (
		<>
			<GenericDataTable
				data={props.members}
				totalPages={Math.ceil(props.totalMembers / props.pageSize)}
				searchPlaceholder={t("Search members...")}
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
						header: t("Name"),
						sortable: true,
					},
					{
						key: "userCallsign",
						header: t("Callsign"),
						sortable: true,
					},
					{
						key: "role",
						header: t("Role"),
						sortable: true,
						cellConfig: {
							variant: "badge",
							valueMap: {
								CLUB_OWNER: t("Owner"),
								MANAGER: t("Manager"),
								USER: t("Member"),
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
						header: t("Status"),
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
						header: t("Join date"),
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
										: t("Not set")}
								</span>
							),
						},
					},
					{
						key: "endDate",
						header: t("Expiry date"),
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
										: t("Unlimited")}
								</span>
							),
						},
					},
					{
						key: "actions",
						header: t("Actions"),
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
											{t("Profile")}
										</Link>
									</DropdownMenuItem>,
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
										</DropdownMenuItem>,
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
											{t("Remove")}
										</DropdownMenuItem>,
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
												userAvatar: row.userAvatar,
											});
										}}
									>
										<Calendar className="size-4 mr-2" />
										{t("Extend")}
									</DropdownMenuItem>,
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
							{ label: t("All roles"), value: "all" },
							{ label: t("Owner"), value: "CLUB_OWNER" },
							{ label: t("Manager"), value: "MANAGER" },
							{ label: t("Member"), value: "USER" },
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
