"use client";
import { Building2, Calendar, Home, LogOut, MapIcon, Menu, Search, Users, X } from "lucide-react";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logos/logo";
import { FontSwitcher } from "@/components/personalization/font/font-switcher";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
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

function useSignOut() {
	const router = useRouter();
	return async () => {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.push("/login");
					posthog.reset();
				},
			},
		});
	};
}

function AccountMenu({ user }: { user: NonNullable<ReturnType<typeof useIsAuthenticated>["user"]> }) {
	const t = useExtracted();
	const signOut = useSignOut();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild={true}>
				<button
					type="button"
					aria-label={t("Account menu")}
					className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<Avatar className="size-9 border select-none">
						<AvatarImage src={user.image || ""} alt="" />
						<AvatarFallback name={user.name} />
					</Avatar>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="mr-4" sideOffset={12}>
				<DropdownMenuLabel>{t("Personalization")}</DropdownMenuLabel>
				<DropdownMenuItem asChild={true}>
					<FontSwitcher />
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild={true} className="cursor-pointer">
					<Button
						variant="ghost"
						onClick={signOut}
						className="w-full cursor-pointer items-center justify-start"
					>
						<LogOut className="h-4 w-4" />
						{t("Sign out")}
					</Button>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function DesktopAuth({ mounted }: { mounted: boolean }) {
	const t = useExtracted();
	const { user } = useIsAuthenticated();
	if (!mounted) {
		return <Skeleton className="h-9 w-24 shrink-0" />;
	}
	if (!user) {
		return (
			<Button asChild={true} size="sm">
				<Link href="/login">{t("Login")}</Link>
			</Button>
		);
	}
	return (
		<>
			<Button asChild={true} size="sm">
				<Link href="/dashboard">{t("Dashboard")}</Link>
			</Button>
			<AccountMenu user={user} />
		</>
	);
}

function DrawerAccount({ mounted }: { mounted: boolean }) {
	const t = useExtracted();
	const { user } = useIsAuthenticated();
	const signOut = useSignOut();
	if (!mounted) {
		return null;
	}
	if (!user) {
		return (
			<DrawerClose asChild={true}>
				<Button asChild={true}>
					<Link href="/login">{t("Login")}</Link>
				</Button>
			</DrawerClose>
		);
	}
	return (
		<>
			<DrawerClose asChild={true}>
				<Button asChild={true}>
					<Link href="/dashboard">{t("Dashboard")}</Link>
				</Button>
			</DrawerClose>
			<FontSwitcher />
			<Button variant="ghost" onClick={signOut} className="w-full justify-start">
				<LogOut className="h-4 w-4" />
				{t("Sign out")}
			</Button>
		</>
	);
}

export function Header() {
	// Read the session on the client so the public layout above us stays statically renderable.
	// A server-side session read there would opt every public/SEO route out of static rendering.
	// The session store can resolve before React hydrates, so the client's first render would
	// disagree with the server-rendered logged-out markup. Render a placeholder until mounted
	// so both sides agree, then swap in the real auth UI.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const t = useExtracted();
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
			<div className="container mx-auto flex h-[68px] items-center gap-3 px-4 sm:px-6">
				<Link
					href="/"
					aria-label={t("RECONNED home")}
					className="flex shrink-0 rounded-md py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<Logo className="h-8 w-auto max-w-[200px] lg:h-9" />
				</Link>

				<nav className="hidden min-w-0 flex-1 justify-center lg:flex" aria-label={t("Navigation")}>
					<ul className="flex items-center gap-1.5">
						{mainLinks.map((item) => {
							const active = isNavActive(pathname, item.href);
							const Icon = item.icon;
							return (
								<li key={item.href} className="shrink-0">
									<Link
										href={item.href}
										aria-current={active ? "page" : undefined}
										className={cn(
											"flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
											active
												? "border-brand/55 bg-brand/10 text-brand"
												: "border-transparent bg-secondary text-foreground hover:bg-secondary/70",
										)}
									>
										<Icon className="size-4 shrink-0" aria-hidden />
										{item.label}
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>

				<div className="flex-1 lg:hidden" />

				<div className="hidden items-center gap-2 lg:flex" suppressHydrationWarning={true}>
					<LanguageSwitcher size="sm" />
					<ThemeSwitcher iconOnly={true} />
					<DesktopAuth mounted={mounted} />
				</div>

				<Button asChild={true} variant="ghost" size="icon" className="lg:hidden">
					<Link href="/search" aria-label={t("Search")}>
						<Search className="size-5" aria-hidden />
					</Link>
				</Button>

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
												"flex items-center gap-3 rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
												active
													? "border-brand/55 bg-brand/10 text-brand"
													: "border-transparent bg-muted/40 text-foreground hover:bg-muted/70",
											)}
										>
											<Icon className="size-5 shrink-0" aria-hidden />
											<span>{item.label}</span>
										</Link>
									</DrawerClose>
								);
							})}
						</nav>
						<div className="mt-auto flex flex-col gap-2 border-t p-3">
							<div className="flex items-center gap-2">
								<LanguageSwitcher sync={false} variant="outline" />
								<ThemeSwitcher sync={false} variant="outline" className="w-auto" />
							</div>
							<DrawerAccount mounted={mounted} />
						</div>
					</DrawerContent>
				</Drawer>
			</div>
		</header>
	);
}
