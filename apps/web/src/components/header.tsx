"use client";
import { Building2, Calendar, Home, LogOut, MapIcon, Menu, Search, Users, X } from "lucide-react";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logos/logo";
import { FontSwitcher } from "@/components/personalization/font/font-switcher";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
import { StyleSwitcher } from "@/components/personalization/style/style-switcher";
import { ThemeSwitcher } from "@/components/personalization/theme/theme-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { authClient, useIsAuthenticated } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

function isNavActive(pathname: string, href: string) {
	if (pathname === href) {
		return true;
	}
	if (href === "/") {
		return false;
	}
	return pathname.startsWith(`${href}/`);
}

export function Header() {
	// Read the session on the client so the public layout above us stays statically renderable.
	// A server-side session read there would opt every public/SEO route out of static rendering.
	const { user } = useIsAuthenticated();
	// The session store can resolve before React hydrates, so the client's first render would
	// disagree with the server-rendered logged-out markup. Render a placeholder until mounted
	// so both sides agree, then swap in the real auth UI.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const t = useExtracted();
	const router = useRouter();
	const pathname = usePathname();

	const mainLinks = [
		{ href: "/events" as const, icon: Calendar, label: t("Events") },
		{ href: "/clubs" as const, icon: Building2, label: t("Clubs") },
		{ href: "/users" as const, icon: Users, label: t("Players") },
		{ href: "/map" as const, icon: MapIcon, label: t("Map") },
		{ href: "/search" as const, icon: Search, label: t("Search") },
	];

	const drawerLinks = [{ href: "/" as const, icon: Home, label: t("Home") }, ...mainLinks];

	return (
		<header className="sticky top-0 z-50 w-full bg-background/20 backdrop-blur-xl">
			<div className="container mx-auto flex flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 lg:min-h-16 lg:flex-row lg:items-center lg:gap-3">
				<Link href="/" className="flex shrink-0 justify-center py-1 lg:justify-start">
					<Logo className="h-8 w-auto max-w-[200px] sm:h-9 md:h-10" />
				</Link>

				<nav
					className="hidden min-w-0 flex-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex [&::-webkit-scrollbar]:hidden"
					aria-label={t("Navigation")}
				>
					<ul className="flex w-full items-center justify-start gap-1 overflow-x-auto overscroll-x-contain pb-0.5 pl-1 lg:justify-center lg:gap-1.5 lg:pl-0">
						{mainLinks.map((item) => {
							const active = isNavActive(pathname, item.href);
							const Icon = item.icon;
							return (
								<li key={item.href} className="shrink-0">
									<Link
										href={item.href}
										aria-current={active ? "page" : undefined}
										className={cn(
											"flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow] sm:gap-2 sm:px-3 sm:text-sm",
											active
												? "border-red-500/50 bg-red-500/10 text-red-500 shadow-sm"
												: "border-transparent bg-background/50 text-muted-foreground hover:border-border hover:bg-background/70 hover:text-foreground",
										)}
									>
										<Icon
											className={cn(
												"size-3.5 shrink-0 sm:size-4",
												active ? "text-red-500" : "opacity-80",
											)}
											aria-hidden
										/>
										<span className="whitespace-nowrap">{item.label}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>

				<div className="flex w-full items-center gap-2 lg:w-auto lg:shrink-0">
					<Drawer direction="left" shouldScaleBackground={false}>
						<DrawerTrigger asChild={true}>
							<Button
								type="button"
								variant="outline"
								size="icon"
								className="shrink-0 lg:hidden"
								aria-label={t("Navigation")}
							>
								<Menu className="size-5" aria-hidden />
							</Button>
						</DrawerTrigger>
						<DrawerContent className="h-full w-[min(100%,20rem)] max-w-sm gap-0 p-0">
							<DrawerHeader className="relative border-b px-4 py-4 pr-12 text-left">
								<DrawerTitle>{t("Navigation")}</DrawerTitle>
								<DrawerClose className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden">
									<X className="size-4" aria-hidden />
									<span className="sr-only">{t("Close")}</span>
								</DrawerClose>
							</DrawerHeader>
							<nav className="flex flex-col gap-1 p-3" aria-label={t("Navigation")}>
								{drawerLinks.map((item) => {
									const active = isNavActive(pathname, item.href);
									const Icon = item.icon;
									return (
										<DrawerClose asChild={true} key={item.href}>
											<Link
												href={item.href}
												aria-current={active ? "page" : undefined}
												className={cn(
													"flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium transition-[color,background-color,border-color]",
													active
														? "border-red-500/50 bg-red-500/10 text-red-500"
														: "border-transparent bg-muted/40 text-foreground hover:bg-muted/70",
												)}
											>
												<Icon
													className={cn(
														"size-5 shrink-0",
														active ? "text-red-500" : "opacity-80",
													)}
													aria-hidden
												/>
												<span>{item.label}</span>
											</Link>
										</DrawerClose>
									);
								})}
							</nav>
						</DrawerContent>
					</Drawer>
					<div
						className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2 lg:min-w-0 lg:flex-none"
						suppressHydrationWarning={true}
					>
						<LanguageSwitcher />
						{!mounted ? (
							<Skeleton className="h-9 w-24 shrink-0 sm:h-10" />
						) : user ? (
							<>
								<Button asChild={true} size="sm" className="max-sm:px-2.5 max-sm:text-xs">
									<Link href="/dashboard">{t("Dashboard")}</Link>
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild={true}>
										<Avatar className="size-9 cursor-pointer border select-none sm:size-10">
											<AvatarImage src={user?.image || ""} alt={user?.name} />
											<AvatarFallback name={user?.name} />
										</Avatar>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="mr-4" sideOffset={12}>
										<DropdownMenuLabel>{t("Personalization")}</DropdownMenuLabel>
										<DropdownMenuItem asChild={true}>
											<ThemeSwitcher />
										</DropdownMenuItem>

										<DropdownMenuItem asChild={true}>
											<FontSwitcher />
										</DropdownMenuItem>
										<DropdownMenuItem asChild={true}>
											<StyleSwitcher />
										</DropdownMenuItem>
										<DropdownMenuSeparator />

										<DropdownMenuItem asChild={true} className="cursor-pointer">
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
												className="w-full cursor-pointer items-center justify-start"
											>
												<LogOut className="h-4 w-4" />
												{t("Sign out")}
											</Button>
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</>
						) : (
							<Button asChild={true} size="sm">
								<Link href="/login">{t("Login")}</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
