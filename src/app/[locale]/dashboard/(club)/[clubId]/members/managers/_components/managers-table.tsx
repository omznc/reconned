"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { demoteFromManager } from "./manager.action";
import { Role } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";

type Manager = {
	id: string;
	role: Role;
	createdAt: Date;
	user: {
		id: string;
		name: string;
		email: string;
		image: string | null;
		callsign: string | null;
	};
};

interface ManagersTableProps {
	managers: Manager[];
	totalManagers: number;
	pageSize: number;
}

export function ManagersTable({ managers, totalManagers, pageSize }: ManagersTableProps) {
	const confirm = useConfirm();
	const params = useParams<{ clubId: string }>();

	const handleDemote = async (manager: Manager) => {
		const confirmed = await confirm({
			title: "Demotuj menadžera",
			body: `Da li ste sigurni da želite demotovati ${manager.user.name} u običnog korisnika?`,
			cancelButton: "Odustani",
			actionButton: "Demotuj",
			actionButtonVariant: "destructive",
		});

		if (!confirmed) return;

		const response = await demoteFromManager({
			memberId: manager.id,
			clubId: params.clubId,
		});

		if (!response?.data?.success) {
			toast.error(response?.data?.error || "Neuspjelo demotovanje menadžera.");
			return;
		}

		toast.success("Menadžer je uspješno demotovan u korisnika.");
	};

	return (
		<GenericDataTable
			data={managers}
			totalPages={Math.ceil(totalManagers / pageSize)}
			searchPlaceholder="Pretraži menadžere..."
			columns={[
				{
					key: "user",
					header: "Član",
					sortable: true,
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<div className="flex items-center gap-2">
								<Avatar className="h-8 w-8">
									<AvatarImage src={row?.user.image ?? undefined} alt="Avatar" />
									<AvatarFallback>
										{row.user.name
											.split(" ")
											.map((name) => name[0])
											.join("")}
									</AvatarFallback>
								</Avatar>
								<span>{row.user.name}</span>
								{row.user.callsign && (
									<span className="text-muted-foreground">({row.user.callsign})</span>
								)}
							</div>
						),
					},
				},
				{
					key: "user.email",
					header: "Email",
					sortable: true,
				},
				{
					key: "createdAt",
					header: "Datum pristupa",
					sortable: true,
				},
				{
					key: "actions",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<div
								className={cn("flex justify-end", {
									"cursor-not-allowed": row.role === Role.CLUB_OWNER,
								})}
							>
								<Button
									variant="destructive"
									size="sm"
									disabled={row.role === Role.CLUB_OWNER}
									onClick={() => handleDemote(row)}
								>
									{row.role === Role.CLUB_OWNER ? "Vlasnik kluba" : "Demotuj"}
								</Button>
							</div>
						),
					},
				},
			]}
		/>
	);
}
