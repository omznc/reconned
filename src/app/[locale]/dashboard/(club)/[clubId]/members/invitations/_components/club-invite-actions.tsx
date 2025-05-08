"use client";

import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Check, X } from "lucide-react";

interface ClubInvite {
	inviteCode: string;
	club: { id: string; };
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
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="sm">
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={() => handleAction("approve")}
					className="text-green-600 focus:text-green-600"
				>
					<Check className="size-4 mr-2" />
					Approve
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => handleAction("dismiss")}
					className="text-destructive focus:text-destructive"
				>
					<X className="size-4 mr-2" />
					Dismiss
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
