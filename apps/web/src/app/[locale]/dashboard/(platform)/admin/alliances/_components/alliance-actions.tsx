"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { EditAllianceDialog } from "./edit-alliance.dialog.tsx";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

interface AllianceActionsProps {
	alliance: AdminAlliance;
}

export function AllianceActions({ alliance }: AllianceActionsProps) {
	const t = useExtracted();
	const router = useRouter();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [editDialogOpen, setEditDialogOpen] = useState(false);

	const deleteMutation = useMutation({
		mutationFn: async (id: number) => {
			await apiClient.DELETE("/api/admin/alliances/{id}", {
				params: {
					path: { id },
				},
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["admin", "alliances"] });
			toast.success(t("Alliance deleted successfully"));
			router.push("/dashboard/admin/alliances");
			router.refresh();
		},
		onError: (error) => {
			console.error("Failed to delete alliance:", error);
			toast.error(t("Failed to delete alliance"));
		},
	});

	const handleDelete = async () => {
		const clubCount = alliance.clubAlliances?.length || 0;

		const confirmed = await confirm({
			title: t("Delete Alliance"),
			body:
				clubCount > 0
					? t("This alliance has {count} club(s). Are you sure you want to delete it?", {
							count: clubCount.toString(),
						})
					: t("Are you sure you want to delete this alliance?"),
			actionButton: t("Delete"),
			cancelButton: t("Cancel"),
		});

		if (confirmed) {
			deleteMutation.mutate(alliance.id);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
						<Pencil className="mr-2 h-4 w-4" />
						{t("Edit")}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={handleDelete} className="text-destructive">
						<Trash2 className="mr-2 h-4 w-4" />
						{t("Delete")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<EditAllianceDialog alliance={alliance} open={editDialogOpen} onOpenChange={setEditDialogOpen} />
		</>
	);
}
