"use client";

import {
	Building2, Search, Pencil, ChartBar, BookUser, MailPlus,
	CalendarFold, Plus, CalendarDays, DiamondMinus, DollarSign, NotebookPen,
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
import type { NavItem } from "@/app/dashboard/_components/sidebar/types";
import { renderCollapsedItem, renderExpandedItem } from "@/app/dashboard/_components/sidebar/utils";

interface NavClubProps {
	user: User & { managedClubs: string[]; };
}

export function NavClub({ user }: NavClubProps) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const { clubId } = useCurrentClub();

	if (!clubId) {
		return null;
	}

	const items = getItems(clubId);
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Moj klub</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					(!(sidebarOpen || isMobile))
						? renderCollapsedItem(item, path)
						: renderExpandedItem(item, path, {
							hasAccess: (subItem) =>
								!subItem.protected ||
								(subItem.protected && user?.managedClubs?.includes(clubId))
						})
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}

const getItems = (clubId: string): NavItem[] => [
	{
		title: "Klub",
		url: "#",
		icon: Building2,
		items: [
			{
				title: "Pregled",
				url: `/dashboard/${clubId}/club`,
				icon: Search,
			},
			{
				title: "Nova objava",
				url: `/dashboard/${clubId}/club/posts`,
				icon: NotebookPen,
				protected: true,
			},
			{
				title: "Potrošnja",
				url: `/dashboard/${clubId}/club/spending`,
				icon: DollarSign,
				isSoon: true,
			},
			{
				title: "Informacije",
				url: `/dashboard/${clubId}/club/information`,
				icon: Pencil,
				protected: true,
			},
			{
				title: "Statistike",
				url: `/dashboard/${clubId}/club/stats`,
				icon: ChartBar,
				protected: true,
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
				protected: true,
			},
			{
				title: "Menadžeri",
				url: `/dashboard/${clubId}/members/managers`,
				icon: BookUser,
				protected: true,
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
				protected: true,
			},
			{
				title: "Kalendar",
				url: `/dashboard/${clubId}/events/calendar`,
				icon: CalendarDays,
			},
			{
				title: "Pravila",
				url: `/dashboard/${clubId}/events/rules`,
				icon: DiamondMinus,
				protected: true,
			},
		],
	},
];
