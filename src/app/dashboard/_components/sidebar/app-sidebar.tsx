"use client";

import { ChevronsUpDown, Loader, LoaderIcon, Plus, Square } from "lucide-react";

import { NavApp } from "@/app/dashboard/_components/sidebar/nav-app";
import { NavClub } from "@/app/dashboard/_components/sidebar/nav-club";
import { UserSwitcher } from "@/app/dashboard/_components/sidebar/user-switcher";
import { useCurrentClub } from "@/components/current-club-provider";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { ROLE_TRANSLATIONS } from "@/lib/utils";
import type { Club, ClubMembership } from "@prisma/client";
import Image from "next/image";
import {
	redirect,
	useParams,
	usePathname,
	useRouter,
	useSearchParams,
} from "next/navigation";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useIsAuthenticated } from "@/lib/auth-client";

interface AppSidebarProps {
	clubs: Club[];
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const { user, loading } = useIsAuthenticated();
	const router = useRouter();
	const params = useParams<{ clubId: string }>();
	const { clubId, setClubId } = useCurrentClub();
	const path = usePathname();
	const searchParams = useSearchParams();
	const activeClub = useMemo(
		() =>
			props.clubs.find(
				(club) => club.id === params.clubId || club.id === clubId,
			),
		[props.clubs, params.clubId, clubId],
	);
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
		if (activeClub) {
			setClubId?.(activeClub.id);
		}
	}, [activeClub, setClubId]);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild={true}>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									{clubId ? (
										<>
											<div className="flex aspect-square size-8 items-center justify-center rounded-lg ">
												{activeClub?.logo ? (
													<Image
														suppressHydrationWarning={true}
														width={32}
														height={32}
														src={`${activeClub.logo}?v=${activeClub.updatedAt}`} // This will revalidate the browser cache
														alt={activeClub.name}
													/>
												) : (
													<Square className="size-4" />
												)}
											</div>
											{activeClub && (
												<div className="grid flex-1 text-left text-sm leading-tight">
													<span className="truncate font-semibold">
														{activeClub?.name}
													</span>
													<span className="truncate text-xs fade-in">
														{user?.managedClubs?.includes(activeClub.id)
															? "Menadžer"
															: "Član"}
													</span>
												</div>
											)}
										</>
									) : (
										<>
											<div className="flex text-background aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-foreground">
												{loading ? (
													<Loader className="size-4 animate-spin" />
												) : (
													<Square className="size-4" />
												)}
											</div>
											<div className="grid flex-1 text-left text-sm leading-tight">
												{loading ? (
													<>
														<span className="bg-sidebar-foreground w-24 h-3 rounded-sm animate-pulse" />
														<span className="bg-sidebar-foreground mt-1 w-16 h-2 rounded-sm animate-pulse" />
													</>
												) : (
													<>
														<span className="truncate fade-in font-semibold">
															Klubovi
														</span>
														<span className="truncate fade-in text-xs">
															Odaberite klub
														</span>
													</>
												)}
											</div>
										</>
									)}
									<ChevronsUpDown className="ml-auto" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
								align="start"
								side="bottom"
								sideOffset={4}
							>
								<DropdownMenuLabel className="text-xs text-muted-foreground">
									Klubovi
								</DropdownMenuLabel>
								{props.clubs.map((club) => (
									<DropdownMenuItem
										key={club.name}
										onClick={() => {
											const currentFullUrl = window.location.href;

											if (!(clubId && currentFullUrl.includes(clubId))) {
												return router.push(`/dashboard/${club.id}`);
											}
											const newUrl = currentFullUrl.replace(clubId, club.id);
											router.push(newUrl);
										}}
										data-active={club.id === clubId}
										className="gap-2 p-2 data-[active=true]:bg-accent"
									>
										<div className="flex size-6 items-center justify-center rounded-sm">
											{club.logo ? (
												<Image
													suppressHydrationWarning={true}
													width={32}
													height={32}
													src={`${club.logo}?v=${club.updatedAt}`} // This will revalidate the browser cache
													alt={club.name}
												/>
											) : (
												<Square className="size-4 text-black" />
											)}
										</div>
										{club.name}
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
								<Link href="/dashboard/add-club">
									<DropdownMenuItem className="gap-2 p-2">
										<div className="flex size-6 items-center justify-center rounded-md border bg-background">
											<Plus className="size-4" />
										</div>
										<div className="font-medium text-muted-foreground">
											Dodaj klub
										</div>
									</DropdownMenuItem>
								</Link>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavApp />
				<NavClub />
			</SidebarContent>
			<SidebarFooter>
				<UserSwitcher />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
