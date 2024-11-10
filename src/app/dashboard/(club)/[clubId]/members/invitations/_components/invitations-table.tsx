"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import type { InviteStatus } from "@prisma/client";

interface FormattedInvite {
	email: string;
	userName: string;
	status: InviteStatus;
	createdAt: Date;
	expiresAt: Date;
	inviteCode: string;
}

interface InvitationsTableProps {
	invites: FormattedInvite[];
	totalPages: number;
}

export function InvitationsTable({
	invites,
	totalPages,
}: InvitationsTableProps) {
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
						},
						badgeVariants: {
							PENDING: "bg-yellow-100 text-yellow-800",
							ACCEPTED: "bg-green-100 text-green-800",
							REJECTED: "bg-red-100 text-red-800",
							EXPIRED: "bg-gray-100 text-gray-800",
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
