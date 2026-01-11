"use client";

import { Check, MoreHorizontal, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type ClubInvite = ApiResponse<"/api/clubs/{id}/invites", "get">["invites"][number];

interface ClubInviteActionsProps {
	invite: ClubInvite;
}

export function ClubInviteActions({ invite }: ClubInviteActionsProps) {
	const router = useRouter();
	const pathname = usePathname();
	const t = useExtracted();
	const [isLoading, setIsLoading] = useState(false);

	const handleAction = async (action: "approve" | "dismiss") => {
		setIsLoading(true);
		try {
			const { error } = await apiClient.POST("/api/club/member-invite/{inviteCode}", {
				params: {
					path: { inviteCode: invite.inviteCode },
					query: {
						action,
						redirectTo: pathname,
					},
				},
			});

			if (error) {
				throw new Error(error.error || t("Failed to process invite"));
			}

			toast.success(action === "approve" ? t("Invite accepted") : t("Invite dismissed"));
			router.refresh();
		} catch (error) {
			const message = error instanceof Error ? error.message : t("An error occurred while processing the invite");
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm" disabled={isLoading}>
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={() => handleAction("approve")}
					className="text-green-600 focus:text-green-600"
					disabled={isLoading}
				>
					<Check className="size-4 mr-2" />
					{t("Accept")}
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => handleAction("dismiss")}
					className="text-destructive focus:text-destructive"
					disabled={isLoading}
				>
					<X className="size-4 mr-2" />
					{t("Dismiss")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
