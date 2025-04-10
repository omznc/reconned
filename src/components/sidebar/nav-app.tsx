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
	Bell,
	Building2,
} from "lucide-react";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";
import type { NavItem } from "./types.ts";
import { renderCollapsedItem, renderExpandedItem } from "./utils.tsx";
import { useTranslations } from "next-intl";

export function NavApp({
	isAdmin,
	pendingInvites,
}: { isAdmin: boolean; pendingInvites: number; }) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const t = useTranslations("components.sidebar");

	const items: NavItem[] = [
		{
			title: t("home"),
			url: "/",
			icon: House,
		},
		{
			title: t("dashboard"),
			url: "/dashboard",
			icon: LayoutDashboard,
		},
		{
			title: t("help"),
			url: "/dashboard/help",
			icon: Info,
		},
		{
			title: t("user"),
			url: "#",
			icon: User,
			items: [
				{
					title: t("overview"),
					url: "/dashboard/user",
					icon: Search,
				},
				{
					title: t("settings"),
					url: "/dashboard/user/settings",
					icon: Cog,
				},
				{
					title: t("security"),
					url: "/dashboard/user/security",
					icon: Key,
				},
				{
					title: `${t("invites")} (${pendingInvites})`,
					url: "/dashboard/user/invites",
					icon: Bell,
				},
			],
		},
		{
			title: t("myEvents"),
			url: "/dashboard/events",
			icon: CalendarFold,
		},
		{
			title: t("admin"),
			url: "#",
			icon: Shield,
			protected: true,
			items: [
				{
					title: t("users"),
					url: "/dashboard/admin/users",
					icon: User,
				},
				{
					title: t("clubs"),
					url: "/dashboard/admin/clubs",
					icon: Building2,
				},
				{
					title: t("emails"),
					url: "/dashboard/admin/emails",
					icon: Mail,
				},
			],
		},
	];

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("dashboard")}</SidebarGroupLabel>
			<SidebarMenu>
				{items
					.filter((item) => !item.protected || (item.protected && isAdmin))
					.map((item) =>
						sidebarOpen || isMobile
							? renderExpandedItem(item, path)
							: renderCollapsedItem(item, path),
					)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
