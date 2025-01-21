import { BadgeSoon } from "@/components/badge-soon";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { NavItem, NavSubItem } from "./types";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuGroup,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenuItem,
	SidebarMenuButton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AdditionalProps {
	hasAccess?: (subItem: NavSubItem) => boolean;
}

export const renderCollapsedItem = (item: NavItem, path: string) => (
	<SidebarMenuItem key={item.title}>
		{item.items ? (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<SidebarMenuButton
						tooltip={item.title}
						isActive={
							item.url === path ||
							item.items?.some((subItem) => subItem.url === path)
						}
					>
						{item.icon && <item.icon />}
					</SidebarMenuButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent side="right" align="start" className="min-w-48">
					<DropdownMenuLabel>{item.title}</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						{item.items.map((subItem) => (
							<DropdownMenuItem key={subItem.title} asChild>
								<Link href={subItem.url}>
									{subItem.icon && <subItem.icon className="mr-2 size-4" />}
									<span>{subItem.title}</span>
									{subItem.isSoon && <BadgeSoon className="ml-2" />}
								</Link>
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		) : (
			<SidebarMenuButton
				isActive={item.url === path}
				tooltip={item.title}
				asChild
			>
				<Link href={item.url}>{item.icon && <item.icon />}</Link>
			</SidebarMenuButton>
		)}
	</SidebarMenuItem>
);

export const renderExpandedItem = (
	item: NavItem,
	path: string,
	additionalProps: AdditionalProps = {},
) => {
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
						{item.isSoon && <BadgeSoon className="ml-2" />}
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	}

	return (
		<Collapsible
			key={item.title}
			asChild={true}
			defaultOpen={item.items?.some((subItem) => subItem.url === path)}
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
						{item.items
							.filter(
								(subItem) =>
									!subItem.protected ||
									(subItem.protected && additionalProps.hasAccess?.(subItem)),
							)
							.map((subItem) => (
								<SidebarMenuSubItem key={subItem.title}>
									<SidebarMenuSubButton
										isActive={subItem.url === path}
										asChild={true}
									>
										<Link href={subItem.url}>
											{subItem.icon && <subItem.icon />}
											<span>{subItem.title}</span>
											{subItem.isSoon && <BadgeSoon className="ml-2" />}
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
};
