"use client";

import {
	Collapsible,
	CollapsibleTrigger,
	CollapsibleContent,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuSub,
	SidebarMenuSubItem,
	SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import Link from "next/link";

import {
	ChevronRight,
	Building2,
	Search,
	Pencil,
	ChartBar,
	BookUser,
	MailPlus,
	CalendarFold,
	Plus,
	CalendarDays,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCurrentClub } from "@/components/current-club-provider";

export function NavClub() {
	const path = usePathname();
	const { clubId } = useCurrentClub();

	if (!clubId) {
		return null;
	}

	const items = getItems(clubId);
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Moj klub</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => {
					if (item?.items && item?.items.length > 0) {
						return (
							<Collapsible
								key={item.title}
								asChild={true}
								defaultOpen={item.isActive}
								className="group/collapsible"
							>
								<SidebarMenuItem>
									<CollapsibleTrigger asChild={true}>
										<SidebarMenuButton
											isActive={
												item.url === path ||
												item.items?.some((subItem) => subItem.url === path)
											}
											tooltip={item.title}
										>
											{item.icon && <item.icon />}
											<span>{item.title}</span>
											<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{item.items?.map((subItem) => (
												<SidebarMenuSubItem key={subItem.title}>
													<SidebarMenuSubButton
														isActive={subItem.url === path}
														asChild={true}
													>
														<Link href={subItem.url}>
															{subItem.icon && <subItem.icon />}
															<span>{subItem.title}</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>
						);
					}

					return (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								isActive={item.url === path}
								tooltip={item.title}
								asChild={true}
							>
								<Link href={item.url}>
									{item.icon && <item.icon />}
									<span>{item.title}</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					);
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}

const getItems = (clubId: string) => {
	return [
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
	];
};
