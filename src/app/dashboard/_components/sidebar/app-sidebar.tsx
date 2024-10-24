"use client";

import {
	BookUser,
	Building2,
	CalendarDays,
	CalendarFold,
	ChartBar,
	ChevronsUpDown,
	GalleryVerticalEnd,
	House,
	MailPlus,
	Pencil,
	Plus,
	Search,
	Settings2,
	Square,
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
} from "@/components/ui/sidebar";
import { NavMain } from "@/app//dashboard/_components/sidebar/nav-main";
import { NavApp } from "@/app//dashboard/_components/sidebar/nav-app";
import { NavUser } from "@/app//dashboard/_components/sidebar/nav-user";
import type { Club, ClubMembership } from "@prisma/client";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { ROLE_TRANSLATIONS } from "@/lib/utils";
import { getTime } from "date-fns";

// This is sample data.
const data = {
	team: {
		name: "Tvrđava",
		logo: GalleryVerticalEnd,
		city: "Zenica",
	},
	navMain: [
		{
			title: "Početna",
			url: "/",
			icon: House,
		},
		{
			title: "Klub",
			url: "#",
			icon: Building2,
			isActive: true,
			items: [
				{
					title: "Pregled",
					url: "/dashboard/club",
					icon: Search,
				},
				{
					title: "Informacije",
					url: "/dashboard/club/information",
					icon: Pencil,
				},
				{
					title: "Statistike",
					url: "/dashboard/club/stats",
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
					url: "/dashboard/members",
					icon: Search,
				},
				{
					title: "Pozivnice",
					url: "/dashboard/members/invitations",
					icon: MailPlus,
				},
				{
					title: "Statistike",
					url: "/dashboard/members/stats",
					icon: ChartBar,
				},
			],
		},
		{
			title: "Događaji",
			url: "#",
			icon: CalendarFold,
			items: [
				{
					title: "Novi događaj",
					url: "/dashboard/events/create",
					icon: Plus,
				},
				{
					title: "Kalendar",
					url: "/dashboard/events/calendar",
					icon: CalendarDays,
				},
				{
					title: "Statistike",
					url: "/dashboard/events/stats",
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
	],
};

interface AppSidebarProps {
	clubs: (Club & {
		members: ClubMembership[];
	})[];
}

export function AppSidebar(props: AppSidebarProps) {
	const [activeClubId, setActiveClubId] = useQueryState("club", {
		defaultValue: props.clubs[0].id,
		clearOnDefault: false,
		shallow: false,
	});

	const activeClub = useMemo(
		() => props.clubs.find((club) => club.id === activeClubId),
		[props.clubs, activeClubId],
	);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<div className="flex aspect-square size-8 items-center justify-center rounded-lg  text-sidebar-primary-foreground">
										{activeClub?.logo ? (
											<Image
												suppressHydrationWarning
												width={32}
												height={32}
												src={`${activeClub.logo}?v=${Date.now()}`} // This will revalidate the browser cache
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
									Teams
								</DropdownMenuLabel>
								{props.clubs.map((club) => (
									<DropdownMenuItem
										key={club.name}
										onClick={() => setActiveClubId(club.id)}
										data-active={club.id === activeClubId}
										className="gap-2 p-2 data-[active=true]:bg-accent"
									>
										<div className="flex size-6 items-center justify-center rounded-sm border">
											{club.logo ? (
												<Image
													suppressHydrationWarning
													width={32}
													height={32}
													src={`${club.logo}?v=${Date.now()}`} // This will revalidate the browser cache
													alt={club.name}
												/>
											) : (
												<Square className="size-4" />
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
				<NavMain items={data.navMain} />
				<NavApp items={data.navApp} />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
