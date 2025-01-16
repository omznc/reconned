"use client";

import { useFont } from "@/components/font-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { useIsAuthenticated } from "@/lib/auth-client";
import { ChevronsUpDown, LogOut, Moon, Sun, Type } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export function UserSwitcher() {
	const { isMobile } = useSidebar();
	const { user } = useIsAuthenticated();
	const { theme, setTheme } = useTheme();
	const { font, setFont } = useFont();
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild={true}>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar className="h-8 w-8 rounded-lg">
								{user?.image && (
									<AvatarImage
										src={`${user?.image}?v=${user?.updatedAt}`}
										alt={user?.name}
									/>
								)}
								<AvatarFallback className="rounded-lg">
									{user?.name?.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">{user?.name}</span>
								<span className="truncate text-xs">{user?.email}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
						side={isMobile ? "bottom" : "right"}
						align="end"
						sideOffset={4}
					>
						<DropdownMenuLabel className="p-0 font-normal">
							<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
								<Avatar className="h-8 w-8 rounded-lg">
									<AvatarImage src={user?.image ?? ""} alt={user?.name} />
									<AvatarFallback className="rounded-lg">
										{user?.name?.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">{user?.name}</span>
									<span className="truncate text-xs">{user?.email}</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Personalizacija</DropdownMenuLabel>
						<DropdownMenuItem asChild={true}>
							<Button
								variant="ghost"
								onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
								suppressHydrationWarning
								className="w-full items-center justify-start cursor-pointer"
							>
								<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
								<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
								Promijeni temu
							</Button>
						</DropdownMenuItem>

						<DropdownMenuItem asChild={true}>
							<Button
								variant="ghost"
								onClick={() => setFont(font === "sans" ? "mono" : "sans")}
								suppressHydrationWarning
								className="w-full items-center justify-start cursor-pointer"
							>
								<Type className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
								Promijeni font
							</Button>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild={true}>
							<Link href="/logout" prefetch={false} className="cursor-pointer plausible-event-name=logout-sidebar-click">
								<LogOut />
								Odjava
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
