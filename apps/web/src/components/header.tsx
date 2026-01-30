"use client";
import type { User } from "better-auth";
import { LogOut } from "lucide-react";
import { useExtracted } from "next-intl";
import posthog from "posthog-js";
import { Logo } from "@/components/logos/logo";
import { FontSwitcher } from "@/components/personalization/font/font-switcher";
import { LanguageSwitcher } from "@/components/personalization/language/language-switcher";
import { StyleSwitcher } from "@/components/personalization/style/style-switcher";
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
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function Header({ user }: { user: User | null }) {
	const t = useExtracted();
	const router = useRouter();

	return (
		<header className="flex flex-col md:flex-row gap-2 select-none w-full items-center justify-between p-4 md:p-4">
			<Link href="/" className="w-full h-auto md:w-fit md:h-full">
				<Logo className="w-full h-auto max-h-[80px] md:w-fit md:h-full p-2 md:p-0" />
			</Link>
			<div className="flex gap-2 md:w-fit w-full" suppressHydrationWarning={true}>
				<LanguageSwitcher />
				{user ? (
					<>
						{/* TODO: Manager-only? */}
						<Button asChild={true} className="w-full">
							<Link href="/dashboard" className="w-full">
								{t("Dashboard")}
							</Link>
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild={true}>
								<Avatar className="size-10 cursor-pointer border select-none">
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
										suppressHydrationWarning
										className="w-full items-center justify-start cursor-pointer"
									>
										<LogOut className="w-4 h-4" />
										{t("Sign out")}
									</Button>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : (
					<Button asChild={true} suppressHydrationWarning={true}>
						<Link className="w-full md:w-fit" suppressHydrationWarning={true} href="/login">
							{t("Login")}
						</Link>
					</Button>
				)}
			</div>
		</header>
	);
}
