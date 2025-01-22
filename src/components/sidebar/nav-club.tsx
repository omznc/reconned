"use client";

import {
	Building2,
	Search,
	Pencil,
	ChartBar,
	BookUser,
	MailPlus,
	CalendarFold,
	Plus,
	CalendarDays,
	DiamondMinus,
	DollarSign,
	NotebookPen,
} from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { useCurrentClub } from "@/components/current-club-provider";
import type { User } from "better-auth";
import type { NavItem } from "@/components/sidebar/types";
import {
	renderCollapsedItem,
	renderExpandedItem,
} from "@/components/sidebar/utils";
import { useTranslations } from "next-intl";

interface NavClubProps {
	user: User & { managedClubs: string[] };
}

export function NavClub({ user }: NavClubProps) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const { clubId } = useCurrentClub();
	const t = useTranslations("components.sidebar");

	if (!clubId) {
		return null;
	}

	const getItems = (clubId: string): NavItem[] => [
		{
			title: t("club"),
			url: "#",
			icon: Building2,
			items: [
				{
					title: t("overview"),
					url: `/dashboard/${clubId}/club`,
					icon: Search,
				},
				{
					title: t("newPost"),
					url: `/dashboard/${clubId}/club/posts`,
					icon: NotebookPen,
					protected: true,
				},
				{
					title: t("spending"),
					url: `/dashboard/${clubId}/club/spending`,
					icon: DollarSign,
					isSoon: true,
				},
				{
					title: t("info"),
					url: `/dashboard/${clubId}/club/information`,
					icon: Pencil,
					protected: true,
				},
				{
					title: t("stats"),
					url: `/dashboard/${clubId}/club/stats`,
					icon: ChartBar,
					protected: true,
				},
			],
		},
		{
			title: t("members"),
			url: "#",
			icon: BookUser,
			items: [
				{
					title: t("overview"),
					url: `/dashboard/${clubId}/members`,
					icon: Search,
				},
				{
					title: t("invitations"),
					url: `/dashboard/${clubId}/members/invitations`,
					icon: MailPlus,
					protected: true,
				},
				{
					title: t("managers"),
					url: `/dashboard/${clubId}/members/managers`,
					icon: BookUser,
					protected: true,
				},
			],
		},
		{
			title: t("events"),
			url: "#",
			icon: CalendarFold,
			items: [
				{
					title: t("overview"),
					url: `/dashboard/${clubId}/events`,
					icon: Search,
				},
				{
					title: t("newEvent"),
					url: `/dashboard/${clubId}/events/create`,
					icon: Plus,
					protected: true,
				},
				{
					title: t("calendar"),
					url: `/dashboard/${clubId}/events/calendar`,
					icon: CalendarDays,
				},
				{
					title: t("rules"),
					url: `/dashboard/${clubId}/events/rules`,
					icon: DiamondMinus,
					protected: true,
				},
			],
		},
	];

	const items = getItems(clubId);
	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("myClub")}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					sidebarOpen || isMobile
						? renderExpandedItem(item, path, {
								hasAccess: (subItem) =>
									!subItem.protected ||
									(subItem.protected && user?.managedClubs?.includes(clubId)),
							})
						: renderCollapsedItem(item, path),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
