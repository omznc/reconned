"use client";
import { FontSwitcher } from "@/components/personalization/font/font-switcher";
import { ThemeSwitcher } from "@/components/personalization/theme/theme-switcher";
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
import { authClient, useIsAuthenticated } from "@/lib/auth-client";
import { ChevronsUpDown, LogOut, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";

export function UserSwitcher() {
	const { isMobile } = useSidebar();
	const t = useTranslations("components.sidebar");
	const { user } = useIsAuthenticated();
	const router = useRouter();
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
									<AvatarImage src={user?.image} alt={user?.name} />
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
							<Link
								href="/dashboard/user"
								className="flex items-center gap-2 px-1 py-1.5 text-left text-sm"
							>
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
							</Link>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>{t("personalization")}</DropdownMenuLabel>
						<DropdownMenuItem asChild={true}>
							<Button
								variant="ghost"
								className="w-full pl-4 items-center justify-start cursor-pointer"
								asChild
							>
								<Link
									href="/dashboard/user/settings"
									className="cursor-pointer"
								>
									<UserCog className="h-[1.2rem] w-[1.2rem] transition-all" />
									{t("settings")}
								</Link>
							</Button>
						</DropdownMenuItem>
						<DropdownMenuItem asChild={true}>
							<ThemeSwitcher />
						</DropdownMenuItem>

						<DropdownMenuItem asChild={true}>
							<FontSwitcher />
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild={true}>
							<Button
								variant="ghost"
								onClick={async () => {
									await authClient.signOut({
										fetchOptions: {
											onSuccess: () => {
												router.push("/login");
											},
										},
									});
								}}
								suppressHydrationWarning
								className="w-full items-center justify-start cursor-pointer"
							>
								<LogOut className="w-4 h-4" />
								{t("logout")}
							</Button>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
