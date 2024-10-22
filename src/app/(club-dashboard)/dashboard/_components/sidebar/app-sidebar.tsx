"use client";

import { BookUser, Building2, GalleryVerticalEnd, House, Settings2 } from "lucide-react";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenuButton,
	SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/app/(club-dashboard)/dashboard/_components/sidebar/nav-main";
import { NavApp } from "@/app/(club-dashboard)/dashboard/_components/sidebar/nav-app";
import { NavUser } from "@/app/(club-dashboard)/dashboard/_components/sidebar/nav-user";

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
				},
				{
					title: "Informacije",
					url: "/dashboard/club/information",
				},
				{
					title: "Statistike",
					url: "/dashboard/club/stats",
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
				},
				{
					title: "Pozivnice",
					url: "/dashboard/members/invitations",
				},
				{
					title: "Statistike",
					url: "/dashboard/members/stats",
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenuButton
					size="lg"
					className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
				>
					<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
						<data.team.logo className="size-4" />
					</div>
					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="truncate font-semibold">{data.team.name}</span>
						<span className="truncate text-xs">{data.team.city}</span>
					</div>
				</SidebarMenuButton>
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
