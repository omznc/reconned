"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { revokeInvitation } from "./invitations.action.tsx";
import type { InviteStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useQueryState } from "nuqs";
import { ClubInviteActions } from "./club-invite-actions";

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

export function InvitationsTable({
	invites,
	totalPages,
}: InvitationsTableProps) {
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.members.invitations.table");

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
			title: t('revoke.title'),
			body: t('revoke.body'),
			cancelButton: t('revoke.cancel'),
			actionButton: t('revoke.confirm'),
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
			toast.error(response?.data?.error || t('revoke.error'));
			return;
		}

		toast.success(t('revoke.success'));
	};

	return (
		<GenericDataTable
			data={invites}
			totalPages={totalPages}
			searchPlaceholder={t('searchPlaceholder')}
			tableConfig={{
				dateFormat: "d. MMMM yyyy.",
				locale: "bs",
			}}
			columns={[
				{
					key: "email",
					header: "Email",
					sortable: true,
				},
				{
					key: "userName",
					header: t('user')
				},
				{
					key: "status",
					header: t('status'),
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							PENDING: t('pending'),
							ACCEPTED: t('accepted'),
							REJECTED: t('rejected'),
							EXPIRED: t('expired'),
							REVOKED: t('revoked'),
							REQUESTED: t('requested'),
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
					header: t('created'),
					sortable: true,
				},
				{
					key: "expiresAt",
					header: t('expires'),
					sortable: true,
				},
				{
					key: "inviteCode",
					header: t('code'),
					cellConfig: {
						variant: "custom",
						component: (value) => (
							<code className="bg-sidebar md:blur-[3px] hover:blur-0 transition-all p-2 font-mono">
								{value}
							</code>
						),
					},
				},
				{
					key: "actions",
					header: t('actions'),
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<>
								{row.status === "REQUESTED" ? (
									<ClubInviteActions invite={row} />
								) : (
									<div
										className={cn("flex justify-end", {
											"cursor-not-allowed": row.status !== "PENDING",
										})}
									>
										<Button
											variant="destructive"
											size="sm"
											disabled={row.status !== "PENDING"}
											onClick={() => handleRevoke(row, row.club.id)}
										>
											{row.status === "PENDING" ? t('revoke.confirm') : t('inactive')}
										</Button>
									</div>
								)}
							</>
						),
					},
				},
			]}
			filters={[
				{
					key: "status",
					label: t('status'),
					options: [
						{ label: t('all'), value: "all" },
						{ label: t('pending'), value: "PENDING" },
						{ label: t('accepted'), value: "ACCEPTED" },
						{ label: t('rejected'), value: "REJECTED" },
						{ label: t('expired'), value: "EXPIRED" },
						{ label: t('revoked'), value: "REVOKED" },
						{ label: t('requested'), value: "REQUESTED" },
					],
				},
			]}
		/>
	);
}
