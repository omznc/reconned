"use client";

import { BanIcon, CheckCircle, TrashIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminClub = ApiResponse<"/api/admin/clubs", "get">["clubs"][number];

export function ClubActions({ club }: { club: AdminClub }) {
	const t = useExtracted();
	const searchParams = useSearchParams();
	const router = useRouter();
	const confirm = useConfirm();

	const onAction = async (action: "ban" | "delete") => {
		const actionText = {
			ban: club.banned ? t("remove ban") : t("ban"),
			delete: t("delete"),
		};

		const confirmed = await confirm({
			title: t("Are you sure?"),
			body: t("Are you sure you want to {action} club {name}?", { action: actionText[action], name: club.name }),
			actionButtonVariant: "default",
			actionButton: t("Yes, confirm"),
			cancelButton: t("No, go back"),
			cancelButtonVariant: "outline",
		});

		if (!confirmed) {
			return;
		}

		try {
			if (action === "ban") {
				const path = club.banned ? "/api/admin/clubs/{id}/unban" : "/api/admin/clubs/{id}/ban";
				const { error } = await apiClient.PUT(path, {
					params: {
						path: {
							id: club.id,
						},
					},
				});
				if (error) {
					throw new Error(error.error || t("Error changing club status."));
				}
			} else {
				const { error } = await apiClient.DELETE("/api/admin/clubs/{id}", {
					params: {
						path: {
							id: club.id,
						},
					},
				});
				if (error) {
					throw new Error(error.error || t("Error deleting club."));
				}
			}
		} catch {
			toast.error(t("An error occurred while performing the action."));
		} finally {
			const params = new URLSearchParams(searchParams);
			params.delete("clubId");
			router.replace(`?${params.toString()}`);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<Button
				variant={club.banned ? "default" : "destructive"}
				onClick={() => {
					onAction("ban");
				}}
			>
				{club.banned ? <CheckCircle /> : <BanIcon />}
				{club.banned ? t("Remove ban") : t("Ban club")}
			</Button>
			<Button
				variant="destructive"
				onClick={() => {
					onAction("delete");
				}}
			>
				<TrashIcon />
				{t("Delete club")}
			</Button>
		</div>
	);
}
