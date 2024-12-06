"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { authClient } from "@/lib/auth-client";
import type { User } from "@prisma/client";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { BanIcon, CheckCircle, TrashIcon, UserIcon } from "lucide-react";

export function UserActions({ user }: { user: User }) {
	const [_, setOpen] = useQueryState("userId", {
		shallow: false,
		defaultValue: "",
		clearOnDefault: true,
	});
	const router = useRouter();
	const confirm = useConfirm();

	const handleBanUser = async () => {
		if (user.banned) {
			await authClient.admin.unbanUser({
				userId: user.id,
			});
		} else {
			await authClient.admin.banUser({
				userId: user.id,
			});
		}
	};

	const handleDeleteUser = async () => {
		await authClient.admin.removeUser({
			userId: user.id,
		});
		router.push("/dashboard/user/admin/users");
	};

	const handleImpersonateUser = async () => {
		await authClient.admin.impersonateUser({
			userId: user.id,
		});
		router.push("/dashboard");
	};

	const onAction = async (action: "ban" | "impersonate" | "delete") => {
		if (!action) {
			return;
		}
		const actionText = {
			ban: user.banned ? "ukloniti ban" : "banovati",
			delete: "izbrisati",
			impersonate: "impersonirati",
		};

		const confirmed = await confirm({
			title: "Jeste li sigurni?",
			body: `Da li ste sigurni da želite ${actionText[action]} korisnika ${user.name}?`,
			actionButtonVariant: "destructive",
			actionButton: "Da, potvrdi",
			cancelButton: "Ne, vrati se",
		});

		if (!confirmed) {
			return;
		}

		try {
			switch (action) {
				case "ban": {
					await handleBanUser();
					break;
				}
				case "delete": {
					await handleDeleteUser();
					break;
				}
				case "impersonate": {
					await handleImpersonateUser();
					break;
				}
				default: {
					break;
				}
			}
		} catch (error) {
			toast.error("Došlo je do greške prilikom izvršavanja akcije.");
		} finally {
			setOpen("");
		}
	};

	return (
		<>
			<div className="flex flex-col gap-2">
				<Button
					variant="default"
					onClick={() => {
						onAction("impersonate");
					}}
				>
					<UserIcon />
					Impersoniraj
				</Button>
				<Button
					variant={user.banned ? "default" : "destructive"}
					onClick={() => {
						onAction("ban");
					}}
				>
					{user.banned ? <CheckCircle /> : <BanIcon />}
					{user.banned ? "Ukloni ban" : "Banuj korisnika"}
				</Button>
				<Button
					variant="destructive"
					onClick={() => {
						onAction("delete");
					}}
				>
					<TrashIcon />
					Izbriši račun
				</Button>
			</div>
		</>
	);
}
