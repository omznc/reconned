"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { leaveClub } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members.action";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

interface LeaveClubButtonProps extends Omit<ButtonProps, "onClick"> {
	clubId: string;
	isClubOwner?: boolean;
	size?: "default" | "sm" | "lg" | "icon";
	renderAsMenuItem?: boolean;
	icon?: ReactNode;
}

export function LeaveClubButton({
	clubId,
	isClubOwner = false,
	size = "default",
	variant = "outline",
	renderAsMenuItem = false,
	icon,
	...props
}: LeaveClubButtonProps) {
	const confirm = useConfirm();
	const t = useTranslations();
	const router = useRouter();

	const handleLeaveClub = async () => {
		if (isClubOwner) {
			toast.error(t("components.leaveClubButton.ownerError"));
			return;
		}

		const confirmed = await confirm({
			title: t("components.leaveClubButton.title"),
			body: t("components.leaveClubButton.body"),
			cancelButton: t("common.actions.cancel"),
			actionButton: t("common.actions.confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		try {
			await leaveClub({ clubId });
			router.push("/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("components.leaveClubButton.error"));
		}
	};

	if (renderAsMenuItem) {
		return (
			<button
				type="button"
				onClick={handleLeaveClub}
				disabled={isClubOwner}
				className={`flex items-center w-full text-left ${isClubOwner ? "opacity-50 pointer-events-none" : "cursor-pointer"} text-destructive`}
				title={isClubOwner ? t("components.leaveClubButton.ownerError") : undefined}
			>
				{icon || <LogOut className="size-4 mr-2" />}
				{t("components.leaveClubButton.action")}
			</button>
		);
	}

	return (
		<Button
			variant={variant}
			onClick={handleLeaveClub}
			disabled={isClubOwner}
			title={isClubOwner ? t("components.leaveClubButton.ownerError") : undefined}
			size={size}
			{...props}
		>
			{icon || <LogOut className="h-4 w-4 mr-2" />}
			{t("components.leaveClubButton.action")}
		</Button>
	);
}
