"use client";

import {
	CalendarFold,
	ChevronRight,
	House,
	Info,
	Shield,
	User,
} from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavApp({ isAdmin }: { isAdmin: boolean }) {
	const path = usePathname();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Aplikacija</SidebarGroupLabel>
			<SidebarMenu>
				{items
					.filter((item) => !item.protected || (item.protected && isAdmin))
					.map((item) => {
						if (!item.items?.length) {
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
						}

						return (
							<Collapsible
								key={item.title}
								asChild={true}
								defaultOpen={item.items?.some(
									(subItem) => subItem.url === path,
								)}
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
											{item.items.map((subItem) => (
												<SidebarMenuSubItem key={subItem.title}>
													<SidebarMenuSubButton
														isActive={subItem.url === path}
														asChild={true}
													>
														<Link href={subItem.url}>
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
					})}
			</SidebarMenu>
		</SidebarGroup>
	);
}

const items = [
	{
		title: "Početna",
		url: "/",
		icon: House,
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
			},
			{
				title: "Postavke",
				url: "/dashboard/user/settings",
			},
			{
				title: "Sigurnost",
				url: "/dashboard/user/security",
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
			},
			{
				title: "Klubovi",
				url: "/dashboard/admin/clubs",
			},
		],
	},
];
