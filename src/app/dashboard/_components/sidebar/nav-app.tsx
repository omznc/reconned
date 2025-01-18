"use client";

import {
	CalendarFold,
	Cog,
	House,
	Info,
	Key,
	LayoutDashboard,
	Mail,
	Search,
	Shield,
	User,
} from "lucide-react";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import type { NavItem } from "./types.ts";
import { renderCollapsedItem, renderExpandedItem } from "./utils.tsx";

export function NavApp({ isAdmin }: { isAdmin: boolean; }) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Aplikacija</SidebarGroupLabel>
			<SidebarMenu>
				{items
					.filter((item) => !item.protected || (item.protected && isAdmin))
					.map((item) =>
						(!(sidebarOpen || isMobile))
							? renderCollapsedItem(item, path)
							: renderExpandedItem(item, path)
					)}
			</SidebarMenu>
		</SidebarGroup>
	);
}

const items: NavItem[] = [
	{
		title: "Početna",
		url: "/",
		icon: House,
	},
	{
		title: "Aplikacija",
		url: "/dashboard",
		icon: LayoutDashboard,
	},
	{
		title: "Pomoć",
		url: "/dashboard/help",
		icon: Info,
	},
	{
		title: "Korisnik",
		url: "#",
		icon: User,
		items: [
			{
				title: "Pregled",
				url: "/dashboard/user",
				icon: Search,
			},
			{
				title: "Postavke",
				url: "/dashboard/user/settings",
				icon: Cog,
			},
			{
				title: "Sigurnost",
				url: "/dashboard/user/security",
				icon: Key,
			},
		],
	},
	{
		title: "Moji Susreti",
		url: "/dashboard/events",
		icon: CalendarFold,
	},
	{
		title: "Administracija",
		url: "#",
		icon: Shield,
		protected: true,
		items: [
			{
				title: "Korisnici",
				url: "/dashboard/admin/users",
				icon: User,
			},
			{
				title: "Klubovi",
				url: "/dashboard/admin/clubs",
				icon: CalendarFold,
				isSoon: true,
			},
			{
				title: "Emailovi",
				url: "/dashboard/admin/emails",
				icon: Mail,
			},
		],
	},
];
