"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api/api.client";
import { cn } from "@/lib/utils";

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
	const t = useExtracted();
	const router = useRouter();

	const handleLeaveClub = async () => {
		if (isClubOwner) {
			toast.error(t("Club owners cannot leave the club. You must first transfer ownership or delete the club."));
			return;
		}

		const confirmed = await confirm({
			title: t("Leave club"),
			body: t("Are you sure you'd like to leave this club? You'll need an invite to join it again."),
			cancelButton: t("Cancel"),
			actionButton: t("Confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		try {
			const { error } = await apiClient.POST("/api/clubs/{id}/members/leave", {
				params: {
					path: {
						id: clubId,
					},
				},
			});

			if (error) {
				toast.error(error.error || t("There was an error while trying to leave the club"));
				return;
			}

			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : t("There was an error while trying to leave the club"),
			);
		}
	};

	if (renderAsMenuItem) {
		return (
			<button
				type="button"
				onClick={handleLeaveClub}
				disabled={isClubOwner}
				className={cn(
					"flex items-center w-full text-left text-destructive",
					isClubOwner ? "opacity-50 pointer-events-none" : "cursor-pointer",
				)}
				title={
					isClubOwner
						? t("Club owners cannot leave the club. You must first transfer ownership or delete the club.")
						: undefined
				}
			>
				{icon || <LogOut className="size-4 mr-2" />}
				{t("Leave club")}
			</button>
		);
	}

	return (
		<Button
			variant={variant}
			onClick={handleLeaveClub}
			disabled={isClubOwner}
			title={
				isClubOwner
					? t("Club owners cannot leave the club. You must first transfer ownership or delete the club.")
					: undefined
			}
			size={size}
			{...props}
		>
			{icon || <LogOut className="h-4 w-4 mr-2" />}
			{t("Leave club")}
		</Button>
	);
}
