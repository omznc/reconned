"use client";

import type { InviteStatus } from "@generated/client";
import { Ban } from "lucide-react";
import { useExtracted } from "next-intl";
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
	const t = useExtracted();

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
			title: t("Are you sure?"),
			body: t("Are you sure you want to revoke the club access invitation?"),
			cancelButton: t("Cancel"),
			actionButton: t("Confirm"),
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
			toast.error(response?.data?.error || t("An error occurred while revoking the invitation"));
			return;
		}

		toast.success(t("Invitation successfully revoked"));
	};

	return (
		<GenericDataTable
			data={invites}
			totalPages={totalPages}
			searchPlaceholder={t("Search invitations...")}
			columns={[
				{
					key: "email",
					header: "Email",
					sortable: true,
				},
				{
					key: "userName",
					header: t("User"),
				},
				{
					key: "status",
					header: t("Status"),
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							PENDING: t("Pending"),
							ACCEPTED: t("Accepted"),
							REJECTED: t("Rejected"),
							EXPIRED: t("Expired"),
							REVOKED: t("Revoked"),
							REQUESTED: t("Requested"),
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
					header: t("Date sent"),
					sortable: true,
				},
				{
					key: "expiresAt",
					header: t("Expires"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("Actions"),
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
									{row.status === "PENDING" ? t("Revoke") : t("Inactive")}
								</DropdownMenuItem>,
							];
						},
					},
				},
			]}
			filters={[
				{
					key: "status",
					label: t("Status"),
					options: [
						{ label: t("All"), value: "all" },
						{ label: t("Pending"), value: "PENDING" },
						{ label: t("Accepted"), value: "ACCEPTED" },
						{ label: t("Rejected"), value: "REJECTED" },
						{ label: t("Expired"), value: "EXPIRED" },
						{ label: t("Revoked"), value: "REVOKED" },
						{ label: t("Requested"), value: "REQUESTED" },
					],
				},
			]}
		/>
	);
}
