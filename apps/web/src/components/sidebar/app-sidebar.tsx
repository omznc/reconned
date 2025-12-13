"use client";

import type { Club } from "@generated/client";
import type { User } from "better-auth";
import { MailPlus, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { useCurrentClub } from "@/components/current-club-provider";
import { ClubSwitcher } from "@/components/sidebar/club-switcher";
import { useCommandMenu } from "@/components/sidebar/command-menu";
import { NavApp } from "@/components/sidebar/nav-app";
import { NavClub } from "@/components/sidebar/nav-club";
import { UserSwitcher } from "@/components/sidebar/user-switcher";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";
import { env } from "@/lib/env";

interface AppSidebarProps {
	clubs: Club[];
	user: User & { managedClubs: string[]; role?: string | null | undefined };
	invitesCount: number;
	inviteRequestsCount: {
		id: string;
		count: number;
	}[];
}

// Component properly using the useCommandMenu hook within the provider context
function SearchButton({ isMac }: { isMac: boolean }) {
	const { toggleOpen } = useCommandMenu();
	const t = useExtracted();
	const sidebar = useSidebar();

	if (!sidebar.open) {
		return null;
	}

	return (
		<Button variant="outline" size="sm" className="w-full h-8 gap-2 text-xs justify-between" onClick={toggleOpen}>
			<div className="flex items-center gap-2">
				<Search className="h-3.5 w-3.5" />
				<span>{t("Search...")}</span>
			</div>
			<kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
				{isMac ? "⌘" : "Ctrl+"}K
			</kbd>
		</Button>
	);
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const params = useParams<{ clubId: string }>();
	const { clubId, setClubId } = useCurrentClub();
	const path = usePathname();
	const t = useExtracted();
	const [isMac, setIsMac] = useState(false);

	const isBeta = env.NEXT_PUBLIC_BETA ?? false;

	useEffect(() => {
		// Detect if user is on macOS
		setIsMac(window.navigator.userAgent.indexOf("Mac") !== -1);
	}, []);

	useEffect(() => {
		if (sidebar.isMobile) {
			sidebar.setOpenMobile(false);
		}
	}, [path, sidebar.isMobile]);

	useEffect(() => {
		if (params.clubId) {
			setClubId?.(params.clubId);
		}
	}, [params.clubId, setClubId]);

	const invites = props.inviteRequestsCount.filter((invite) => invite.id === clubId)[0];

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<ClubSwitcher clubs={props.clubs} user={props.user} />
				<SearchButton isMac={isMac} />
			</SidebarHeader>
			<SidebarContent>
				<NavApp isAdmin={props.user.role === "admin"} pendingInvites={props.invitesCount} />
				{clubId && <NavClub user={props.user} clubId={clubId} />}
			</SidebarContent>
			<SidebarFooter>
				{props.invitesCount > 0 &&
					(sidebar.open ? (
						<Link href="/dashboard/user/invites" className="px-3 py-2 border bg-red-500/10">
							<p className="text-xs text-muted-foreground">
								{t("You have {count} pending invitation/s", {
									count: String(props.invitesCount),
								})}
							</p>
						</Link>
					) : (
						<Link
							href="/dashboard/user/invites"
							className="px-1 py-2 border bg-red-500/10 flex flex-col items-center"
						>
							<MailPlus size={12} />
						</Link>
					))}
				{(invites?.count ?? 0) > 0 &&
					(sidebar.open ? (
						<Link
							href={`/dashboard/${invites?.id}/members/invitations?status=REQUESTED`}
							className="px-3 py-2 border bg-red-500/10"
						>
							<p className="text-xs text-muted-foreground">
								{t("Your club has {count} pending join request/s", {
									count: String(invites?.count ?? "0"),
								})}
							</p>
						</Link>
					) : (
						<Link
							href={`/dashboard/${invites?.id}/members/invitations?status=REQUESTED`}
							className="px-1 py-2 border bg-red-500/10 flex flex-col items-center"
						>
							<MailPlus size={12} />
						</Link>
					))}
				{isBeta && (
					<SidebarMenu>
						<SidebarMenuItem>
							{sidebar.open ? (
								<div className="px-3 py-2 border bg-background/20">
									<p className="text-xs text-muted-foreground">
										{t("Beta version - Changes and errors are possible.")}
									</p>
								</div>
							) : (
								<div className="px-1 py-2 border bg-background/20 flex flex-col items-center">
									<p className="text-xs text-muted-foreground">B</p>
									<p className="text-xs text-muted-foreground">E</p>
									<p className="text-xs text-muted-foreground">T</p>
									<p className="text-xs text-muted-foreground">A</p>
								</div>
							)}
						</SidebarMenuItem>
					</SidebarMenu>
				)}
				<UserSwitcher user={props.user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
