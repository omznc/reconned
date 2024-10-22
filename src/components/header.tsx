"use client";

import { Logo } from "@/app/(public)/logo";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useIsAuthenticated } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import Link from "next/link";

export function Header() {
	const { data: session } = useIsAuthenticated();
	const user = session?.user;

	return (
		<header className="flex select-none w-full items-center justify-between p-4">
			<Logo />
			<div className="flex gap-2">
				{user ? (
					<>
						{/* TODO: Manager-only? */}
						<Button asChild={true}>
							<Link href="/dashboard">Moj Klub</Link>
						</Button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Avatar className="size-10 rounded-lg select-none">
									<AvatarImage src={user?.image} alt={user?.name} />
									<AvatarFallback className="rounded-lg">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
								</Avatar>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="mr-4" sideOffset={12}>
								<DropdownMenuItem>
									<Link href="/logout" className="flex items-center gap-2">
										<LogOut className="w-4 h-4" />
										Odjava
									</Link>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</>
				) : (
					<Button asChild={true}>
						<Link href="/login">Prijava</Link>
					</Button>
				)}
			</div>
		</header>
	);
}
