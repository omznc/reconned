"use client";

import { BanIcon, CheckCircle, TrashIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminClub = ApiResponse<"/api/admin/clubs", "get">["clubs"][number];

export function ClubActions({ club }: { club: AdminClub }) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const confirm = useConfirm();

	const onAction = async (action: "ban" | "delete") => {
		const actionText = {
			ban: club.banned ? "ukloniti ban" : "banovati",
			delete: "izbrisati",
		};

		const confirmed = await confirm({
			title: "Jeste li sigurni?",
			body: `Da li ste sigurni da želite ${actionText[action]} klub ${club.name}?`,
			actionButtonVariant: "default",
			actionButton: "Da, potvrdi",
			cancelButton: "Ne, vrati se",
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
					throw new Error(error.error ?? "Greška prilikom izmjene statusa kluba.");
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
					throw new Error(error.error ?? "Greška prilikom brisanja kluba.");
				}
			}
		} catch {
			toast.error("Došlo je do greške prilikom izvršavanja akcije.");
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
				{club.banned ? "Ukloni ban" : "Banuj klub"}
			</Button>
			<Button
				variant="destructive"
				onClick={() => {
					onAction("delete");
				}}
			>
				<TrashIcon />
				Izbriši klub
			</Button>
		</div>
	);
}
