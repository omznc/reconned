"use client";

import { MoreHorizontal, UserMinus } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { cn } from "@/lib/utils";

type Managers = ApiResponse<"/api/clubs/{id}/members", "get">["members"];
interface ManagersTableProps {
	managers: Managers;
	totalManagers: number;
	pageSize: number;
}

export function ManagersTable({ managers, totalManagers, pageSize }: ManagersTableProps) {
	const confirm = useConfirm();
	const t = useExtracted();
	const params = useParams<{ clubId: string }>();

	const handleDemote = async (manager: Managers[number]) => {
		const confirmed = await confirm({
			title: t("Demote manager"),
			body: t("Are you sure you want to demote {managerName} to a regular user?", {
				managerName: manager.user.name,
			}),
			cancelButton: t("Cancel"),
			actionButton: t("Demote"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		try {
			const { error } = await apiClient.PUT("/api/clubs/{id}/members/{memberId}", {
				params: {
					path: {
						id: params.clubId,
						memberId: manager.id,
					},
				},
				body: {
					role: "USER",
				},
			});

			if (error) {
				throw new Error(error.error || t("Failed to demote manager."));
			}

			toast.success(t("Manager has been demoted to a regular user."));
		} catch (error) {
			const message = error instanceof Error ? error.message : t("Failed to demote manager.");
			toast.error(message);
		}
	};

	return (
		<GenericDataTable
			data={managers}
			totalPages={Math.ceil(totalManagers / pageSize)}
			searchPlaceholder={t("Search managers...")}
			columns={[
				{
					key: "user",
					header: t("Member"),
					sortable: true,
					cellConfig: {
						variant: "custom",
						component: (_, row) => (
							<div className="flex items-center gap-2">
								<Avatar className="h-8 w-8">
									<AvatarImage src={row?.user.image || undefined} alt="Avatar" />
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
					header: t("Email"),
					sortable: true,
				},
				{
					key: "createdAt",
					header: t("Access date"),
					sortable: true,
				},
				{
					key: "actions",
					header: t("Actions"),
					cellConfig: {
						variant: "custom",
						component: (_, row) => {
							const isOwner = row.role === "CLUB_OWNER";
							return (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" className="h-8 w-8 p-0">
											<span className="sr-only">{t("Open menu")}</span>
											<MoreHorizontal className="h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={() => handleDemote(row)}
											disabled={isOwner}
											className={cn(!isOwner && "text-destructive focus:text-destructive")}
										>
											<UserMinus className="size-4 mr-2" />
											{isOwner ? t("Club owner") : t("Demote")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							);
						},
					},
				},
			]}
		/>
	);
}
