"use client";

import {
	BookUser,
	Building2,
	CalendarDays,
	CalendarFold,
	ChartBar,
	ChevronsUpDown,
	House,
	Info,
	MailPlus,
	Pencil,
	Plus,
	Search,
	Settings2,
	Square,
	User,
} from "lucide-react";

import Image from "next/image";
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
import { NavMain } from "@/app/dashboard/_components/sidebar/nav-main";
import { NavApp } from "@/app/dashboard/_components/sidebar/nav-app";
import { NavUser } from "@/app/dashboard/_components/sidebar/nav-user";
import type { Club, ClubMembership } from "@prisma/client";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useEffect, useMemo } from "react";
import { ROLE_TRANSLATIONS } from "@/lib/utils";
import {
	redirect,
	useParams,
	usePathname,
	useRouter,
	useSearchParams,
} from "next/navigation";

const getData = (clubId: string) => ({
	navMain: [
		{
			title: "Početna",
			url: "/",
			icon: House,
		},
		{
			title: "Pomoć",
			url: `/dashboard/${clubId}/help`,
			icon: Info,
		},
		{
			title: "Klub",
			url: "#",
			icon: Building2,
			isActive: true,
			items: [
				{
					title: "Pregled",
					url: `/dashboard/${clubId}/club`,
					icon: Search,
				},
				{
					title: "Informacije",
					url: `/dashboard/${clubId}/club/information`,
					icon: Pencil,
				},
				{
					title: "Statistike",
					url: `/dashboard/${clubId}/club/stats`,
					icon: ChartBar,
				},
			],
		},
		{
			title: "Članovi",
			url: "#",
			icon: BookUser,
			items: [
				{
					title: "Pregled",
					url: `/dashboard/${clubId}/members`,
					icon: Search,
				},
				{
					title: "Pozivnice",
					url: `/dashboard/${clubId}/members/invitations`,
					icon: MailPlus,
				},
				{
					title: "Statistike",
					url: `/dashboard/${clubId}/members/stats`,
					icon: ChartBar,
				},
			],
		},
		{
			title: "Susreti",
			url: "#",
			icon: CalendarFold,
			items: [
				{
					title: "Pregled",
					url: `/dashboard/${clubId}/events`,
					icon: Search,
				},
				{
					title: "Novi susret",
					url: `/dashboard/${clubId}/events/create`,
					icon: Plus,
				},
				{
					title: "Kalendar",
					url: `/dashboard/${clubId}/events/calendar`,
					icon: CalendarDays,
				},
				{
					title: "Statistike",
					url: `/dashboard/${clubId}/events/stats`,
					icon: ChartBar,
				},
			],
		},
	],
	navApp: [
		{
			title: "Postavke",
			url: "#",
			icon: Settings2,
			items: [
				{
					title: "Općenito",
					url: "/dashboard/settings",
				},
				{
					title: "Personalizacija",
					url: "/dashboard/settings/personalization",
				},
			],
		},
		{
			title: "Korisnik",
			url: "#",
			icon: User,
			items: [
				{
					title: "Pregled",
					url: "/dashboard/user",
				},
				{
					title: "Postavke",
					url: "/dashboard/user/settings",
				},
			],
		},
	],
});

interface AppSidebarProps {
	clubs: (Club & {
		members: ClubMembership[];
	})[];
}

export function AppSidebar(props: AppSidebarProps) {
	const sidebar = useSidebar();
	const router = useRouter();
	const params = useParams<{ clubId: string }>();
	const path = usePathname();
	const searchParams = useSearchParams();
	const activeClub = useMemo(
		() => props.clubs.find((club) => club.id === params.clubId),
		[props.clubs, params.clubId],
	);
	const data = getData(params.clubId);

	useEffect(() => {
		if (searchParams.get("autoSelectFirst") && !params.clubId) {
			const firstClub = props.clubs[0];
			if (firstClub) {
				redirect(`/dashboard/${firstClub.id}`);
			}
		}
	}, [params.clubId, props.clubs, searchParams]);

	useEffect(() => {
		console.log("Path changed", path);
		if (sidebar.isMobile) {
			sidebar.setOpenMobile(false);
		}
	}, [path, sidebar.isMobile]);

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
									{params.clubId ? (
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
											<div className="grid flex-1 text-left text-sm leading-tight">
												<span className="truncate font-semibold">
													{activeClub?.name}
												</span>
												<span className="truncate text-xs">
													{activeClub?.members[0]?.role &&
														ROLE_TRANSLATIONS[activeClub?.members[0]?.role]}
												</span>
											</div>
										</>
									) : (
										<>
											<div className="flex text-background aspect-square size-8 items-center justify-center rounded-lg bg-foreground">
												?
											</div>
											<div className="grid flex-1 text-left text-sm leading-tight">
												<span className="truncate font-semibold">Klubovi</span>
												<span className="truncate text-xs">Odaberite klub</span>
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

											if (
												!(
													params.clubId &&
													currentFullUrl.includes(params.clubId)
												)
											) {
												return router.push(`/dashboard/${club.id}`);
											}
											const newUrl = currentFullUrl.replace(
												params.clubId,
												club.id,
											);
											router.push(newUrl);
										}}
										data-active={club.id === params.clubId}
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
								<DropdownMenuItem className="gap-2 p-2">
									<div className="flex size-6 items-center justify-center rounded-md border bg-background">
										<Plus className="size-4" />
									</div>
									<div className="font-medium text-muted-foreground">
										Add team
									</div>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{params.clubId && <NavMain items={data.navMain} />}
				<NavApp items={data.navApp} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
