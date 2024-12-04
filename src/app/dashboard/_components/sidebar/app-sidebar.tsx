"use client";

import { ChevronsUpDown, Plus, Square } from "lucide-react";

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
import type { Club } from "@prisma/client";
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
import type { User } from "better-auth";

interface AppSidebarProps {
	clubs: Club[];
	user: User & { managedClubs: string[]; role?: string | null | undefined };
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const router = useRouter();
	const params = useParams<{ clubId: string }>();
	const { clubId, setClubId } = useCurrentClub();
	const path = usePathname();
	const searchParams = useSearchParams();
	const activeClub = useMemo(
		() => props.clubs.find((club) => club.id === params.clubId),
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

	const selectedClub = props.clubs.find((club) => club.id === clubId);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild={true}>
								<SidebarMenuButton
									key={activeClub?.id}
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									{clubId ? (
										<>
											<div className="flex aspect-square size-8 items-center justify-center rounded-lg ">
												{selectedClub?.logo ? (
													<Image
														suppressHydrationWarning={true}
														width={32}
														height={32}
														src={`${selectedClub.logo}?v=${selectedClub.updatedAt.toISOString()}`} // This will revalidate the browser cache
														alt={selectedClub.name}
													/>
												) : (
													<Square className="size-4" />
												)}
											</div>
											{clubId ? (
												<div className="grid flex-1 text-left text-sm leading-tight">
													<span className="truncate font-semibold">
														{selectedClub?.name}
													</span>
													<span className="truncate text-xs fade-in">
														{props.user?.managedClubs?.includes(clubId)
															? "Menadžer"
															: "Član"}
													</span>
												</div>
											) : (
												<div className="grid flex-1 text-left text-sm leading-tight">
													<span className="truncate fade-in font-semibold">
														Klubovi
													</span>
													<span className="truncate fade-in text-xs">
														Odaberite klub
													</span>
												</div>
											)}
										</>
									) : (
										<>
											<div className="flex text-background aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-foreground">
												<Square className="size-4" />
											</div>
											<div className="grid flex-1 text-left text-sm leading-tight">
												<span className="truncate fade-in font-semibold">
													Klubovi
												</span>
												<span className="truncate fade-in text-xs">
													Odaberite klub
												</span>
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
				<NavApp isAdmin={props.user.role === "admin"} />
				<NavClub user={props.user} />
			</SidebarContent>
			<SidebarFooter>
				<UserSwitcher />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
