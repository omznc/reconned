"use client";
import type { User } from "better-auth";
import { ChevronsUpDown, LogOut, UserCog } from "lucide-react";
import { useTranslations } from "next-intl";
import posthog from "posthog-js";
import { FontSwitcher } from "@/components/personalization/font/font-switcher";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
import { RoundnessSwitcher } from "@/components/personalization/roundness/roundness-switcher";
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
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function UserSwitcher(props: { user: User }) {
	const { isMobile } = useSidebar();
	const t = useTranslations();
	const router = useRouter();
	const { user } = props;

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild={true}>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Avatar key={user?.image} className="h-8 w-8">
								{user?.image && user.image.length > 0 && (
									<AvatarImage src={user?.image} alt={user?.name} />
								)}
								<AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">{user?.name}</span>
								<span className="truncate text-xs">{user?.email}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
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
						<DropdownMenuLabel>{t("components.sidebar.personalization")}</DropdownMenuLabel>
						<DropdownMenuItem asChild={true}>
							<Button
								variant="ghost"
								className="w-full pl-4 items-center justify-start cursor-pointer"
								asChild
							>
								<Link href="/dashboard/user/settings" className="cursor-pointer">
									<UserCog className="h-[1.2rem] w-[1.2rem] transition-all" />
									{t("components.sidebar.settings")}
								</Link>
							</Button>
						</DropdownMenuItem>
						<DropdownMenuItem asChild={true}>
							<ThemeSwitcher />
						</DropdownMenuItem>

						<DropdownMenuItem asChild={true}>
							<FontSwitcher />
						</DropdownMenuItem>
						<DropdownMenuItem asChild={true}>
							<RoundnessSwitcher />
						</DropdownMenuItem>
						<DropdownMenuItem asChild={true}>
							<LanguageSwitcher />
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
												posthog.reset();
											},
										},
									});
								}}
								suppressHydrationWarning
								className="w-full items-center justify-start pl-4 cursor-pointer"
							>
								<LogOut className="w-4 h-4" />
								{t("components.sidebar.logout")}
							</Button>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
