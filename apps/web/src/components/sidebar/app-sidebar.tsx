"use client";

import type { User } from "better-auth";
import { MailPlus, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { Suspense, use, useEffect, useState } from "react";
import { useClubs } from "@/components/clubs-provider";
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
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";

type InviteRequestCount = {
	id: string;
	count: number;
};

/**
 * The two counts arrive as promises rather than resolved values. They only drive badges and
 * banners, so making the dashboard layout `await` them meant nothing on the page — sidebar, nav
 * or `children` — could render until both round-trips came back. Passing them unresolved lets the
 * shell paint immediately and each consumer stream in under its own Suspense boundary.
 */
interface AppSidebarProps {
	user: User & { role?: string | null | undefined };
	invitesCountPromise: Promise<number>;
	inviteRequestsCountPromise: Promise<InviteRequestCount[]>;
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

/**
 * Suspends on the invite count so `NavApp` can show its badge. The fallback renders the same nav
 * with a zero badge rather than a skeleton — the nav items themselves don't depend on the count,
 * so this streams the badge in without the list shifting or flashing.
 */
function NavAppWithInvites({
	isAdmin,
	invitesCountPromise,
}: {
	isAdmin: boolean;
	invitesCountPromise: Promise<number>;
}) {
	const invitesCount = use(invitesCountPromise);
	return <NavApp isAdmin={isAdmin} pendingInvites={invitesCount} />;
}

/** The footer notification banners. Both are conditional, so `null` is a faithful fallback. */
function InviteBanners({
	invitesCountPromise,
	inviteRequestsCountPromise,
	clubId,
	open,
}: {
	invitesCountPromise: Promise<number>;
	inviteRequestsCountPromise: Promise<InviteRequestCount[]>;
	clubId?: string;
	open: boolean;
}) {
	const t = useExtracted();
	const invitesCount = use(invitesCountPromise);
	const inviteRequestsCount = use(inviteRequestsCountPromise);

	const invites = inviteRequestsCount.filter((invite) => invite.id === clubId)[0];

	return (
		<>
			{invitesCount > 0 &&
				(open ? (
					<Link href="/dashboard/user/invites" className="px-3 py-2 border bg-red-500/10">
						<p className="text-xs text-muted-foreground">
							{t("You have {count} pending invitation/s", {
								count: String(invitesCount),
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
			{(invites?.count || 0) > 0 &&
				(open ? (
					<Link
						href={`/dashboard/${invites?.id}/members/invitations?status=REQUESTED`}
						className="px-3 py-2 border bg-red-500/10"
					>
						<p className="text-xs text-muted-foreground">
							{t("Your club has {count} pending join request/s", {
								count: String(invites?.count || "0"),
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
		</>
	);
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const params = useParams<{ clubId: string }>();
	const { clubId, setClubId } = useCurrentClub();
	const { clubs } = useClubs();
	const path = usePathname();
	const [isMac, setIsMac] = useState(false);

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

	const isAdmin = props.user.role === "admin";

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<ClubSwitcher clubs={clubs} />
				<SearchButton isMac={isMac} />
			</SidebarHeader>
			<SidebarContent>
				<Suspense fallback={<NavApp isAdmin={isAdmin} pendingInvites={0} />}>
					<NavAppWithInvites isAdmin={isAdmin} invitesCountPromise={props.invitesCountPromise} />
				</Suspense>
				{clubId && <NavClub clubId={clubId} clubs={clubs} />}
			</SidebarContent>
			<SidebarFooter>
				<Suspense fallback={null}>
					<InviteBanners
						invitesCountPromise={props.invitesCountPromise}
						inviteRequestsCountPromise={props.inviteRequestsCountPromise}
						clubId={clubId}
						open={sidebar.open}
					/>
				</Suspense>
				<UserSwitcher user={props.user} />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
