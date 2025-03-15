"use client";

import { ChevronsUpDown, Plus, Square } from "lucide-react";
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
} from "@/components/ui/sidebar";
import { useCurrentClub } from "@/components/current-club-provider";
import type { Club } from "@prisma/client";
import Image from "next/image";
import { Link, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

interface ClubSwitcherProps {
	clubs: Club[];
	user: { managedClubs: string[]; };
}

export function ClubSwitcher({ clubs, user }: ClubSwitcherProps) {
	const router = useRouter();
	const params = useParams<{ clubId: string; }>();
	const { clubId } = useCurrentClub();
	const t = useTranslations("components.sidebar");

	const activeClub = useMemo(
		() => clubs.find((club) => club.id === params.clubId),
		[clubs, params.clubId, clubId],
	);

	const selectedClub = clubs.find((club) => club.id === clubId);

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild={true}>
						<SidebarMenuButton
							key={activeClub?.id}
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							{clubId ? (
								<>
									<div className="flex aspect-square size-8 items-center justify-center rounded-lg ">
										{selectedClub?.logo ? (
											<Image
												suppressHydrationWarning={true}
												width={32}
												height={32}
												src={selectedClub.logo}
												alt={selectedClub.name}
											/>
										) : (
											<Square className="size-4" />
										)}
									</div>
									{clubId ? (
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-semibold">
												{selectedClub?.name}
											</span>
											<span className="truncate text-xs fade-in">
												{user?.managedClubs?.includes(clubId)
													? t("manager")
													: t("member")}
											</span>
										</div>
									) : (
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate fade-in font-semibold">
												{t("clubs")}
											</span>
											<span className="truncate fade-in text-xs">
												{t("selectClub")}
											</span>
										</div>
									)}
								</>
							) : (
								<>
									<div className="flex text-background aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-foreground">
										<Square className="size-4" />
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate fade-in font-semibold">
											{t("clubs")}
										</span>
										<span className="truncate fade-in text-xs">
											{t("selectClub")}
										</span>
									</div>
								</>
							)}
							<ChevronsUpDown className="ml-auto" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
						align="start"
						side="bottom"
						sideOffset={4}
					>
						<DropdownMenuLabel className="text-xs text-muted-foreground">
							{t("clubs")}
						</DropdownMenuLabel>
						{clubs.map((club) => (
							<DropdownMenuItem
								key={club.id}
								onClick={() => {
									const currentFullUrl = window.location.href;

									if (!(clubId && currentFullUrl.includes(clubId))) {
										return router.push(`/dashboard/${club.id}`);
									}
									const newUrl = currentFullUrl.replace(clubId, club.id);
									router.push(newUrl);
								}}
								data-active={club.id === clubId}
								className="gap-2 p-2 data-[active=true]:bg-accent"
							>
								<div className="flex size-6 items-center justify-center rounded-sm">
									{club.logo ? (
										<Image
											suppressHydrationWarning={true}
											width={32}
											height={32}
											src={club.logo}
											alt={club.name}
										/>
									) : (
										<Square className="size-4 text-black" />
									)}
								</div>
								{club.name}
							</DropdownMenuItem>
						))}
						<DropdownMenuSeparator />
						<Link href="/dashboard/add-club">
							<DropdownMenuItem className="gap-2 p-2">
								<div className="flex size-6 items-center justify-center rounded-md border bg-background">
									<Plus className="size-4" />
								</div>
								<div className="font-medium text-muted-foreground">
									{t("addClub")}
								</div>
							</DropdownMenuItem>
						</Link>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
