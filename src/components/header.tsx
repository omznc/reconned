"use client";

import { Logo } from "@/components/logos/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient, useIsAuthenticated } from "@/lib/auth-client";
import { LoaderIcon, LogOut } from "lucide-react";
import Link from "next/link";

export function Header() {
	const { user, loading } = useIsAuthenticated();

	return (
		<header className="flex flex-col md:flex-row gap-4 select-none w-full items-center justify-between p-2 md:p-4">
			<Link href="/">
				<Logo />
			</Link>
			<div
				className="flex gap-2 md:w-fit w-full"
				suppressHydrationWarning={true}
			>
				{user ? (
					<>
						{/* TODO: Manager-only? */}
						<Button asChild={true} className="w-full">
							<Link href="/dashboard?autoSelectFirst=true" className="w-full">
								Moj Klub
							</Link>
						</Button>
						<ThemeSwitcher />
						<DropdownMenu>
							<DropdownMenuTrigger asChild={true}>
								<Avatar className="size-10 cursor-pointer border rounded-none select-none">
									<AvatarImage src={user?.image} alt={user?.name} />
									<AvatarFallback className="rounded-none">
										{user?.name?.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="mr-4" sideOffset={12}>
								<DropdownMenuItem asChild={true} className="cursor-pointer">
									<Link
										href="/logout"
										prefetch={false}
										className="flex items-centergap-2"
									>
										<LogOut className="w-4 h-4" />
										Odjava
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : (
					<>
						{loading ? (
							<Avatar className="size-10 cursor-pointer border rounded-none select-none">
								<AvatarFallback className="rounded-none">
									<LoaderIcon className="size-4 animate-spin" />
								</AvatarFallback>
							</Avatar>
						) : (
							<Button asChild={true} suppressHydrationWarning={true}>
								<Link
									className="w-full md:w-fit"
									suppressHydrationWarning={true}
									href="/login"
								>
									Prijava
								</Link>
							</Button>
						)}
					</>
				)}
			</div>
		</header>
	);
}
