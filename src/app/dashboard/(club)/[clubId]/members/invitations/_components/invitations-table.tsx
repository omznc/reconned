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
	const t = useTranslations("dashboard.club.members.invitations");
	const path = usePathname();
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
			title: "Opozovi pozivnicu",
			body: `Da li ste sigurni da želite opozvati pozivnicu za ${invite.email}?`,
			cancelButton: "Odustani",
			actionButton: "Opozovi",
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
			toast.error(response?.data?.error || "Neuspjelo opozivanje pozivnice.");
			return;
		}

		toast.success("Pozivnica je uspješno opozvana.");
	};

	return (
		<GenericDataTable
			data={invites}
			totalPages={totalPages}
			searchPlaceholder="Pretraži pozivnice..."
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
					header: "Korisnik",
				},
				{
					key: "status",
					header: "Status",
					sortable: true,
					cellConfig: {
						variant: "badge",
						valueMap: {
							PENDING: "Na čekanju",
							ACCEPTED: "Prihvaćeno",
							REJECTED: "Odbijeno",
							EXPIRED: "Isteklo",
							REVOKED: "Opozvano",
							REQUESTED: "Zahtjev",
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
					header: "Datum slanja",
					sortable: true,
				},
				{
					key: "expiresAt",
					header: "Ističe",
					sortable: true,
				},
				{
					key: "inviteCode",
					header: "Kod pozivnice",
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
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<>
								{row.status === "REQUESTED" ? (
									<div className="flex gap-2 ">
										<Link
											prefetch={false}
											href={`/api/club/member-invite/${row.inviteCode}?redirectTo=${encodeURIComponent(
												path,
											)}`}
											className="inline-flex"
										>
											<Button variant="default">{t("approve")}</Button>
										</Link>
										<Link
											prefetch={false}
											href={`/api/club/member-invite/${row.inviteCode}?action=dismiss&redirectTo=${encodeURIComponent(
												path,
											)}`}
											className="inline-flex"
										>
											<Button variant="destructive">{t("dismiss")}</Button>
										</Link>
									</div>
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
											{row.status === "PENDING" ? "Opozovi" : "Nije aktivna"}
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
					label: "Filter po statusu",
					options: [
						{ label: "Svi statusi", value: "all" },
						{ label: "Na čekanju", value: "PENDING" },
						{ label: "Prihvaćeno", value: "ACCEPTED" },
						{ label: "Odbijeno", value: "REJECTED" },
						{ label: "Isteklo", value: "EXPIRED" },
					],
				},
			]}
		/>
	);
}
