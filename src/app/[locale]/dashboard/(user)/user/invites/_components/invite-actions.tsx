"use client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

interface Invite {
	inviteCode: string;
	club: { id: string };
}

interface InviteActionsProps {
	invite: Invite;
}

export function InviteActions({ invite }: InviteActionsProps) {
	const router = useRouter();

	const handleAction = async (action: "approve" | "dismiss") => {
		// using POST for actions
		const res = await fetch(
			`/api/club/member-invite/${invite.inviteCode}?action=${action}&redirectTo=${encodeURIComponent(
				"/dashboard/user/invites",
			)}`,
			{
				method: "GET",
			},
		);
		if (res.ok) {
			router.refresh();
		}
	};

	return (
		<div className="flex gap-2">
			<Button
				onClick={async () => {
					await handleAction("approve");
				}}
				variant="default"
			>
				Approve
			</Button>
			<Button
				onClick={async () => {
					await handleAction("dismiss");
				}}
				variant="outline"
			>
				Dismiss
			</Button>
		</div>
	);
}
