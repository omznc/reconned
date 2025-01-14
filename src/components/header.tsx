"use client";

import { useFont } from "@/components/font-switcher";
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
import { LogOut, Moon, Sun, Type } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";

export function Header({ user }: { user: User | null }) {
	const { theme, setTheme } = useTheme();
	const { font, setFont } = useFont();
	return (
		<header className="flex flex-col md:flex-row gap-4 select-none w-full items-center justify-between p-2 md:p-4">
			<Link href="/" className="w-full h-auto md:w-fit md:h-full">
				<Logo className="w-full h-auto md:w-fit md:h-full p-2 md:p-0" />
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
								Aplikacija
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
								<DropdownMenuLabel>Personalizacija</DropdownMenuLabel>
								<DropdownMenuItem asChild={true}>
									<Button
										variant="ghost"
										onClick={() =>
											setTheme(theme === "dark" ? "light" : "dark")
										}
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
			</div>
		</header>
	);
}
