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
import {
	redirect,
	useParams,
	usePathname,
	useSearchParams,
} from "next/navigation";
import { useEffect } from "react";
import type { User } from "better-auth";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";

interface AppSidebarProps {
	clubs: Club[];
	user: User & { managedClubs: string[]; role?: string | null | undefined; };
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const params = useParams<{ clubId: string; }>();
	const { setClubId } = useCurrentClub();
	const path = usePathname();
	const searchParams = useSearchParams();
	const t = useTranslations("components.sidebar");

	// TODO: We'll do beta only now, but otherwise we'll keep this only on the beta subdomain.
	const isBeta = env.NEXT_PUBLIC_BETTER_AUTH_URL?.includes("beta") || true;


	useEffect(() => {
		if (searchParams.get("autoSelectFirst") && !params.clubId) {
			const firstClub = props.clubs[0];
			if (firstClub) {
				redirect(`/dashboard/${firstClub.id}`);
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

	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader>
				<ClubSwitcher clubs={props.clubs} user={props.user} />
			</SidebarHeader>
			<SidebarContent>
				<NavApp isAdmin={props.user.role === "admin"} />
				<NavClub user={props.user} />
			</SidebarContent>
			<SidebarFooter>
				{
					isBeta && (
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
					)
				}
				<UserSwitcher />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
