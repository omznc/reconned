"use client";

import {
	CalendarFold,
	ChevronRight,
	Cog,
	House,
	Info,
	Key,
	Mail,
	Search,
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
									<CollapsibleContent className="pt-1">
										<SidebarMenuSub>
											{item.items.map((subItem) => (
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
			},
			{
				title: "Emailovi",
				url: "/dashboard/admin/emails",
				icon: Mail,
			},
		],
	},
];
