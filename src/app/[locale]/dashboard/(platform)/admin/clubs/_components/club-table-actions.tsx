"use client";

import type { Club } from "@generated/client";
import { BanIcon, CheckCircle, TrashIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { clubAdminAction } from "@/app/[locale]/dashboard/(platform)/admin/clubs/_components/club.actions";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

export function ClubActions({ club }: { club: Club }) {
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
			const resp = await clubAdminAction({
				clubId: club.id,
				action: action === "ban" ? (club.banned ? "unban" : "ban") : "remove",
			});
			if (!resp?.data?.success) {
				throw new ActionError("Došlo je do greške prilikom izvršavanja akcije.");
			}
			// Optionally toast success message or refresh data
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
