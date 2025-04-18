"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";

interface ClubInvite {
	inviteCode: string;
	club: { id: string };
}

interface ClubInviteActionsProps {
	invite: ClubInvite;
}

export function ClubInviteActions({ invite }: ClubInviteActionsProps) {
	const router = useRouter();
	const pathname = usePathname();

	const handleAction = async (action: "approve" | "dismiss") => {
		const url =
			action === "approve"
				? `/api/club/member-invite/${invite.inviteCode}?redirectTo=${encodeURIComponent(pathname)}`
				: `/api/club/member-invite/${invite.inviteCode}?action=dismiss&redirectTo=${encodeURIComponent(
						pathname,
					)}`;
		const res = await fetch(url);
		if (res.ok) {
			router.refresh();
		}
	};

	return (
		<div className="flex gap-2">
			<Button
				onClick={() => {
					handleAction("approve");
				}}
				variant="default"
			>
				Approve
			</Button>
			<Button
				onClick={() => {
					handleAction("dismiss");
				}}
				variant="destructive"
			>
				Dismiss
			</Button>
		</div>
	);
}
