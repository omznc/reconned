"use client";

import { BanIcon, CheckCircle, TrashIcon, UserIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { authClient } from "@/lib/auth-client";

type User = ApiResponse<"/api/admin/users/{id}", "get">;

export function UserActions({ user }: { user: User }) {
	const t = useExtracted();
	const searchParams = useSearchParams();
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
		window.location.reload();
	};

	const onAction = async (action: "ban" | "impersonate" | "delete") => {
		if (!action) {
			return;
		}
		const actionText = {
			ban: user.banned ? t("remove ban") : t("ban"),
			delete: t("delete"),
			impersonate: t("impersonate"),
		};

		const confirmed = await confirm({
			title: t("Are you sure?"),
			body: t("Are you sure you want to {action} user {name}?", { action: actionText[action], name: user.name }),
			actionButtonVariant: "default",
			actionButton: t("Yes, confirm"),
			cancelButton: t("No, go back"),
			cancelButtonVariant: "outline",
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
		} catch {
			toast.error(t("An error occurred while performing the action."));
		} finally {
			const params = new URLSearchParams(searchParams);
			params.delete("userId");
			router.replace(`?${params.toString()}`);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<Button
				variant="default"
				onClick={() => {
					onAction("impersonate");
				}}
			>
				<UserIcon />
				{t("Impersonate")}
			</Button>
			<Button
				variant={user.banned ? "default" : "destructive"}
				onClick={() => {
					onAction("ban");
				}}
			>
				{user.banned ? <CheckCircle /> : <BanIcon />}
				{user.banned ? t("Remove ban") : t("Ban user")}
			</Button>
			<Button
				variant="destructive"
				onClick={() => {
					onAction("delete");
				}}
			>
				<TrashIcon />
				{t("Delete account")}
			</Button>
		</div>
	);
}
