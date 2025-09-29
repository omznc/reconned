"use client";

import type { InviteStatus } from "@generated/client";
import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useEffect } from "react";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ClubInviteActions } from "./club-invite-actions.tsx";
import { revokeInvitation } from "./invitations.action.tsx";

interface FormattedInvite {
	id: string;
	email: string;
	userName: string;
	status: InviteStatus;
	createdAt: Date;
	expiresAt: Date;
	inviteCode: string;
	club: {
		id: string;
	};
}

interface InvitationsTableProps {
	invites: FormattedInvite[];
	totalPages: number;
}

export function InvitationsTable({ invites, totalPages }: InvitationsTableProps) {
	const confirm = useConfirm();
	const t = useTranslations();

	const [message] = useQueryState("message");
	useEffect(() => {
		toast.dismiss("message");
		if (message) {
			toast.success(decodeURIComponent(message), {
				id: "message",
			});
		}
	}, [message]);

	const handleRevoke = async (invite: FormattedInvite, clubId: string) => {
		if (invite.status !== "PENDING") {
			return;
		}

		const confirmed = await confirm({
			title: t("dashboard.club.members.invitations.table.revoke.title"),
			body: t("dashboard.club.members.invitations.table.revoke.body"),
			cancelButton: t("common.actions.cancel"),
			actionButton: t("common.actions.confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		const response = await revokeInvitation({
			inviteId: invite.id,
			clubId: clubId,
		});

		if (!response?.data?.success) {
			toast.error(response?.data?.error || t("dashboard.club.members.invitations.table.revoke.error"));
			return;
		}

		toast.success(t("dashboard.club.members.invitations.table.revoke.success"));
	};

	return (
		<GenericDataTable
			data={invites}
			totalPages={totalPages}
			searchPlaceholder={t("dashboard.club.members.invitations.table.searchPlaceholder")}
			columns={[
				{
					key: "email",
					header: "Email",
					sortable: true,
				},
				{
					key: "userName",
					header: t("dashboard.club.members.invitations.table.user"),
				},
				{
					key: "status",
					header: t("dashboard.club.members.invitations.table.status"),
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							PENDING: t("dashboard.club.members.invitations.table.pending"),
							ACCEPTED: t("dashboard.club.members.invitations.table.accepted"),
							REJECTED: t("dashboard.club.members.invitations.table.rejected"),
							EXPIRED: t("dashboard.club.members.invitations.table.expired"),
							REVOKED: t("dashboard.club.members.invitations.table.revoked"),
							REQUESTED: t("dashboard.club.members.invitations.table.requested"),
						},
						badgeVariants: {
							PENDING: "bg-yellow-100 text-yellow-800",
							ACCEPTED: "bg-green-100 text-green-800",
							REJECTED: "bg-red-100 text-red-800",
							EXPIRED: "bg-gray-100 text-gray-800",
							REVOKED: "bg-orange-100 text-orange-800",
							REQUESTED: "bg-blue-100 text-blue-800",
						},
					},
				},
				{
					key: "createdAt",
					header: t("dashboard.club.members.invitations.table.created"),
					sortable: true,
				},
				{
					key: "expiresAt",
					header: t("dashboard.club.members.invitations.table.expires"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("dashboard.club.members.invitations.table.actions"),
					cellConfig: {
						variant: "custom",
						components: (row) => {
							if (row.status === "REQUESTED") {
								return [<ClubInviteActions key="invite-actions" invite={row} />];
							}
							return [
								<DropdownMenuItem
									key="revoke"
									onClick={() => handleRevoke(row, row.club.id)}
									disabled={row.status !== "PENDING"}
									className={
										row.status === "PENDING" ? "text-destructive focus:text-destructive" : ""
									}
								>
									<Ban className="size-4 mr-2" />
									{row.status === "PENDING"
										? t("dashboard.club.members.invitations.table.revoke.confirm")
										: t("dashboard.club.members.invitations.table.inactive")}
								</DropdownMenuItem>,
							];
						},
					},
				},
			]}
			filters={[
				{
					key: "status",
					label: t("dashboard.club.members.invitations.table.status"),
					options: [
						{ label: t("dashboard.club.members.invitations.table.all"), value: "all" },
						{ label: t("dashboard.club.members.invitations.table.pending"), value: "PENDING" },
						{ label: t("dashboard.club.members.invitations.table.accepted"), value: "ACCEPTED" },
						{ label: t("dashboard.club.members.invitations.table.rejected"), value: "REJECTED" },
						{ label: t("dashboard.club.members.invitations.table.expired"), value: "EXPIRED" },
						{ label: t("dashboard.club.members.invitations.table.revoked"), value: "REVOKED" },
						{ label: t("dashboard.club.members.invitations.table.requested"), value: "REQUESTED" },
					],
				},
			]}
		/>
	);
}
