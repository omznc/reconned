"use client";
import { Logo } from "@/components/logos/logo";
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
import type { User } from "better-auth";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeSwitcher } from "@/components/personalization/theme/theme-switcher";
import { FontSwitcher } from "@/components/personalization/font/font-switcher";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";

export function Header({
	user,
}: {
	user: User | null;
}) {
	const t = useTranslations("components.header");
	const path = usePathname();

	return (
		<header className="flex flex-col md:flex-row gap-2 select-none w-full items-center justify-between p-2 md:p-4">
			<Link href="/" className="w-full h-auto md:w-fit md:h-full">
				<Logo className="w-full h-auto max-h-[80px] md:w-fit md:h-full p-2 md:p-0" />
			</Link>
			{path !== "/" && (
				<Button asChild variant="ghost" className="w-full hover:bg-transparent">
					<Link href="/" className="w-full h-auto md:w-fit md:h-full">
						<ArrowLeft className="w-6 h-6" />
						{t("backToHome")}
					</Link>
				</Button>
			)}
			<div
				className="flex gap-2 md:w-fit w-full"
				suppressHydrationWarning={true}
			>
				<LanguageSwitcher />
				{user ? (
					<>
						{/* TODO: Manager-only? */}
						<Button asChild={true} className="w-full">
							<Link href="/dashboard?autoSelectFirst=true" className="w-full">
								{t("dashboard")}
							</Link>
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild={true}>
								<Avatar className="size-10 cursor-pointer border rounded-none select-none">
									<AvatarImage src={user?.image ?? ""} alt={user?.name} />
									<AvatarFallback className="rounded-none">
										{user?.name?.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="mr-4" sideOffset={12}>
								<DropdownMenuLabel>{t("personalization")}</DropdownMenuLabel>
								<DropdownMenuItem asChild={true}>
									<ThemeSwitcher />
								</DropdownMenuItem>

								<DropdownMenuItem asChild={true}>
									<FontSwitcher />
								</DropdownMenuItem>
								<DropdownMenuSeparator />

								<DropdownMenuItem asChild={true} className="cursor-pointer">
									<Link
										href="/logout"
										prefetch={false}
										className="flex items-centergap-2 plausible-event-name=logout-header-click"
									>
										<LogOut className="w-4 h-4" />
										{t("logout")}
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : (
					<Button asChild={true} suppressHydrationWarning={true}>
						<Link
							className="w-full md:w-fit"
							suppressHydrationWarning={true}
							href="/login"
						>
							{t("login")}
						</Link>
					</Button>
				)}
			</div>
		</header>
	);
}
