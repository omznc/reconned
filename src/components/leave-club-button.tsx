"use client";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { toast } from "sonner";
import { leaveClub } from "@/app/[locale]/dashboard/(club)/[clubId]/members/_components/members.action";
import { useRouter } from "@/i18n/navigation";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ButtonProps } from "@/components/ui/button";

interface LeaveClubButtonProps extends Omit<ButtonProps, "onClick"> {
	clubId: string;
	isClubOwner?: boolean;
	size?: "default" | "sm" | "lg" | "icon";
}

export function LeaveClubButton({
	clubId,
	isClubOwner = false,
	size = "default",
	variant = "outline",
	...props
}: LeaveClubButtonProps) {
	const confirm = useConfirm();
	const t = useTranslations("components.leaveClubButton");
	const router = useRouter();

	const handleLeaveClub = async () => {
		if (isClubOwner) {
			toast.error(t("ownerError"));
			return;
		}

		const confirmed = await confirm({
			title: t("title"),
			body: t("body"),
			cancelButton: t("cancel"),
			actionButton: t("confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		try {
			await leaveClub({ clubId });
			router.push("/dashboard");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t("error"));
		}
	};

	return (
		<Button
			variant={variant}
			onClick={handleLeaveClub}
			disabled={isClubOwner}
			title={isClubOwner ? t("ownerError") : undefined}
			size={size}
			{...props}
		>
			<LogOut className="h-4 w-4 mr-2" />
			{t("action")}
		</Button>
	);
}
