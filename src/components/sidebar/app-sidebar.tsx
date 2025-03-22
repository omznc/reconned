"use client";

import { NavApp } from "@/components/sidebar/nav-app";
import { NavClub } from "@/components/sidebar/nav-club";
import { UserSwitcher } from "@/components/sidebar/user-switcher";
import { ClubSwitcher } from "@/components/sidebar/club-switcher";
import { useCurrentClub } from "@/components/current-club-provider";
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
import type { Club } from "@prisma/client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { User } from "better-auth";
import { useLocale, useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { Link, redirect, usePathname } from "@/i18n/navigation";
import { MailPlus } from "lucide-react";

interface AppSidebarProps {
	clubs: Club[];
	user: User & { managedClubs: string[]; role?: string | null | undefined; };
	invitesCount: number;
	inviteRequestsCount: {
		id: string;
		count: number;
	}[];
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const params = useParams<{ clubId: string; }>();
	const { clubId, setClubId } = useCurrentClub();
	const path = usePathname();
	const searchParams = useSearchParams();
	const locale = useLocale();
	const t = useTranslations("components.sidebar");

	const isBeta = env.NEXT_PUBLIC_BETTER_AUTH_URL?.includes("beta");

	useEffect(() => {
		if (searchParams.get("autoSelectFirst") && !params.clubId) {
			const firstClub = props.clubs[0];
			if (firstClub) {
				return redirect({
					href: `/dashboard/${firstClub.id}`,
					locale,
				});
			}
		}
	}, [params.clubId, props.clubs, searchParams]);

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

	const invites = props.inviteRequestsCount.filter(
		(invite) => invite.id === clubId,
	)[0];

	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader>
				<ClubSwitcher clubs={props.clubs} user={props.user} />
			</SidebarHeader>
			<SidebarContent>
				<NavApp
					isAdmin={props.user.role === "admin"}
					pendingInvites={props.invitesCount}
				/>
				<NavClub user={props.user} />
			</SidebarContent>
			<SidebarFooter>
				{props.invitesCount > 0 &&
					(sidebar.open ? (
						<Link
							href="/dashboard/user/invites"
							className="px-3 py-2 border bg-red-500/10"
						>
							<p className="text-xs text-muted-foreground">
								{t("pendingInvitesMessage", { count: props.invitesCount })}
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
								{t("inviteRequestsMessage", { count: invites?.count ?? 0 })}
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
										{t("betaMessage")}
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
				<UserSwitcher />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
