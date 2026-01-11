"use client";

import { useExtracted } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useClubs } from "@/components/clubs-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";

interface Invite {
	inviteCode: string;
	club: { id: string };
}

interface InviteActionsProps {
	invite: Invite;
}

export function InviteActions({ invite }: InviteActionsProps) {
	const router = useRouter();
	const t = useExtracted();
	const { refreshClubs } = useClubs();
	const [isLoading, setIsLoading] = useState(false);

	const handleAction = async (action: "approve" | "dismiss") => {
		setIsLoading(true);
		try {
			const { error } = await apiClient.POST("/api/club/member-invite/{inviteCode}", {
				params: {
					path: { inviteCode: invite.inviteCode },
					query: {
						action,
						redirectTo: "/dashboard/user/invites",
					},
				},
			});

			if (error) {
				throw new Error(error.error || t("Failed to process invite"));
			}

			toast.success(action === "approve" ? t("Invite accepted") : t("Invite dismissed"));

			// Refresh the clubs list if the user accepted the invite (they joined a club)
			if (action === "approve") {
				await refreshClubs();
			}

			router.refresh();
		} catch (error) {
			const message = error instanceof Error ? error.message : t("An error occurred while processing the invite");
			toast.error(message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex gap-2">
			<Button
				onClick={async () => {
					await handleAction("approve");
				}}
				variant="default"
				disabled={isLoading}
			>
				{t("Accept")}
			</Button>
			<Button
				onClick={async () => {
					await handleAction("dismiss");
				}}
				variant="outline"
				disabled={isLoading}
			>
				{t("Dismiss")}
			</Button>
		</div>
	);
}
