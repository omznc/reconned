"use client";

import * as React from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useRouter } from "@/i18n/navigation";
import { useCurrentClub } from "@/components/current-club-provider";
import Image from "next/image";
import {
	Square,
	Calendar,
	UserCog,
	UserIcon,
	Key,
	Settings,
	Bell,
	Building2,
	Search,
	BookUser,
	CalendarDays,
	Plus,
	NotebookPen,
	ChartBar,
	DollarSign,
	MailPlus,
	LayoutDashboard,
	Pencil,
	House,
	Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Club } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "better-auth";
import {
	Credenza,
	CredenzaContent,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";

interface CommandMenuProps {
	clubs: Club[];
	user: User & { managedClubs: string[]; role?: string | null | undefined };
}

type CommandItemType = {
	name: string;
	link: string;
	icon: React.ElementType;
	shortcut?: string;
	club?: Club;
	isProtected?: boolean;
	isNav?: boolean;
};

export function CommandMenu({ clubs, user }: CommandMenuProps) {
	const { open, setOpen } = useCommandMenu();
	const [search, setSearch] = React.useState("");
	const router = useRouter();
	const { clubId } = useCurrentClub();
	const t = useTranslations("components.sidebar");
	const inputRef = React.useRef<HTMLInputElement>(null);

	const handleClubSelection = (club: Club) => {
		const currentFullUrl = window.location.href;

		if (clubId && currentFullUrl.includes(clubId)) {
			const newUrl = currentFullUrl.replace(clubId, club.id);
			router.push(newUrl);
		} else {
			router.push(`/dashboard/${club.id}`);
		}
		setOpen(false);
	};

	const handleCommand = (link: string) => {
		router.push(link);
		setOpen(false);
	};

	// Generate navigation items
	const generateNavItems = (): CommandItemType[] => {
		return [
			{ name: t("home"), link: "/", icon: House, isNav: true },
			{
				name: t("dashboard"),
				link: "/dashboard",
				icon: LayoutDashboard,
				isNav: true,
			},
			{ name: t("help"), link: "/dashboard/help", icon: Info, isNav: true },
			{
				name: t("myEvents"),
				link: "/dashboard/events",
				icon: Calendar,
				isNav: true,
			},
			{
				name: t("profile"),
				link: "/dashboard/user",
				icon: UserIcon,
				isNav: true,
			},
			{
				name: t("settings"),
				link: "/dashboard/user/settings",
				icon: UserCog,
				isNav: true,
			},
			{
				name: t("security"),
				link: "/dashboard/user/security",
				icon: Key,
				isNav: true,
			},
			{
				name: t("invites"),
				link: "/dashboard/user/invites",
				icon: Bell,
				isNav: true,
			},
		];
	};

	// Generate club-specific items
	const generateClubItems = (club: Club): CommandItemType[] => {
		const isManager = user?.managedClubs?.includes(club.id);

		const items: CommandItemType[] = [
			{
				name: t("overview"),
				link: `/dashboard/${club.id}/club`,
				icon: Search,
				club,
			},
		];

		if (isManager) {
			items.push(
				{
					name: t("newPost"),
					link: `/dashboard/${club.id}/club/posts`,
					icon: NotebookPen,
					isProtected: true,
					club,
				},
				{
					name: t("spending"),
					link: `/dashboard/${club.id}/club/spending`,
					icon: DollarSign,
					isProtected: true,
					club,
				},
				{
					name: t("info"),
					link: `/dashboard/${club.id}/club/information`,
					icon: Pencil,
					isProtected: true,
					club,
				},
				{
					name: t("stats"),
					link: `/dashboard/${club.id}/club/stats`,
					icon: ChartBar,
					isProtected: true,
					club,
				},
			);
		}

		items.push({
			name: t("members"),
			link: `/dashboard/${club.id}/members`,
			icon: BookUser,
			club,
		});

		if (isManager) {
			items.push(
				{
					name: t("invitations"),
					link: `/dashboard/${club.id}/members/invitations`,
					icon: MailPlus,
					isProtected: true,
					club,
				},
				{
					name: t("managers"),
					link: `/dashboard/${club.id}/members/managers`,
					icon: BookUser,
					isProtected: true,
					club,
				},
			);
		}

		items.push(
			{
				name: t("events"),
				link: `/dashboard/${club.id}/events`,
				icon: Calendar,
				club,
			},
			{
				name: t("calendar"),
				link: `/dashboard/${club.id}/events/calendar`,
				icon: CalendarDays,
				club,
			},
		);

		if (isManager) {
			items.push({
				name: t("newEvent"),
				link: `/dashboard/${club.id}/events/create`,
				icon: Plus,
				isProtected: true,
				club,
			});
		}

		return items;
	};

	// Create all items for filtering
	const allItems = React.useMemo(() => {
		const navItems = generateNavItems();

		let clubItems: CommandItemType[] = [];
		for (const club of clubs) {
			clubItems = [...clubItems, ...generateClubItems(club)];
		}

		return [...navItems, ...clubItems];
	}, [clubs, clubId]);

	// Filter items based on search
	const filteredItems = React.useMemo(() => {
		if (!search) {
			return allItems;
		}

		const lowerSearch = search.toLowerCase();

		return allItems.filter(
			(item) =>
				item.name.toLowerCase().includes(lowerSearch) ||
				item.club?.name?.toLowerCase().includes(lowerSearch),
		);
	}, [allItems, search]);

	// Group filtered items
	const navItems = filteredItems.filter((item) => item.isNav);
	const clubItems = filteredItems.filter((item) => !item.isNav);

	React.useEffect(() => {
		const handleShiftNumberPress = (event: KeyboardEvent) => {
			// Handle Shift + number keys (1-9) for quick club switching
			if (event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
				// Check if the pressed key is a number from 1-9
				const num = Number.parseInt(event.key, 10);
				if (!Number.isNaN(num) && num >= 1 && num <= 9) {
					const clubIndex = num - 1;
					if (clubs[clubIndex]) {
						event.preventDefault();
						handleClubSelection(clubs[clubIndex]);
					}
				}
			}
		};

		// Add event listeners
		document.addEventListener("keydown", handleShiftNumberPress);

		// Clean up
		return () => {
			document.removeEventListener("keydown", handleShiftNumberPress);
		};
	}, [clubs]);

	// Focus input when dialog opens
	React.useEffect(() => {
		if (open && inputRef.current) {
			setTimeout(() => {
				inputRef.current?.focus();
			}, 0);
		}
	}, [open]);

	// Reset search when dialog closes
	React.useEffect(() => {
		if (!open) {
			setSearch("");
		}
	}, [open]);

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger className="hidden">{null}</CredenzaTrigger>
			<CredenzaContent className="p-0 overflow-hidden">
				<CredenzaTitle className="sr-only">
					{t("searchPlaceholder")}
				</CredenzaTitle>
				<Command>
					<CommandInput
						ref={inputRef}
						placeholder={t("searchPlaceholder")}
						value={search}
						onValueChange={setSearch}
						className="border-none focus:ring-0"
					/>
					<CommandList className="overflow-y-auto overflow-x-hidden">
						<CommandEmpty>{t("noResults")}</CommandEmpty>

						{/* User navigation section */}
						{navItems.length > 0 && (
							<CommandGroup heading={t("navigation")}>
								{navItems.map((item) => (
									<CommandItem
										key={item.link}
										onSelect={() => handleCommand(item.link)}
										className="flex items-center gap-3 py-3"
									>
										<div className="flex items-center gap-3 flex-1">
											<item.icon className="h-4 w-4" />
											<span>{item.name}</span>
										</div>
										{item.shortcut && (
											<CommandShortcut>{item.shortcut}</CommandShortcut>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{/* Clubs section */}
						<CommandGroup heading={t("clubs")}>
							{clubs.map((club, index) => (
								<CommandItem
									key={club.id}
									onSelect={() => handleClubSelection(club)}
									className="flex items-center gap-3 py-3"
								>
									<div className="flex items-center gap-3 flex-1">
										<Building2 className="h-4 w-4" />
										<span>{club.name}</span>
									</div>
									{index < 9 && <CommandShortcut>⇧{index + 1}</CommandShortcut>}
								</CommandItem>
							))}
						</CommandGroup>

						{/* Club items */}
						{clubItems.length > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup heading={t("navigation")}>
									{clubItems.map((item) => (
										<CommandItem
											key={`${item.club?.id || ""}-${item.link}`}
											onSelect={() => handleCommand(item.link)}
											className="flex items-center py-3"
										>
											<div className="flex items-center gap-3 flex-1">
												<item.icon className="h-4 w-4" />
												<span>{item.name}</span>
											</div>
											{item.club && (
												<div className="flex items-center gap-2">
													<span className="text-xs text-muted-foreground">
														{item.club.name}
													</span>
													<div className="flex h-5 w-5 items-center justify-center">
														{item.club.logo ? (
															<Image
																suppressHydrationWarning={true}
																width={20}
																height={20}
																src={item.club.logo}
																alt={item.club.name}
																className="rounded-sm"
															/>
														) : (
															<Square className="h-4 w-4" />
														)}
													</div>
												</div>
											)}
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}

						{/* User account section */}
						<CommandSeparator />
						<CommandGroup heading={t("account")}>
							<CommandItem
								onSelect={() => handleCommand("/dashboard/user")}
								className="flex items-center gap-3 py-3"
							>
								<div className="flex h-7 w-7 items-center justify-center">
									<Avatar className="h-7 w-7">
										{user?.image && (
											<AvatarImage src={user.image} alt={user?.name || ""} />
										)}
										<AvatarFallback>
											{user?.name?.charAt(0).toUpperCase() || "U"}
										</AvatarFallback>
									</Avatar>
								</div>
								<div className="flex flex-col">
									<span className="font-medium">{user?.name}</span>
									<span className="text-xs text-muted-foreground">
										{user?.email}
									</span>
								</div>
							</CommandItem>
							<CommandItem
								onSelect={() => handleCommand("/dashboard/user/settings")}
								className="flex items-center gap-3 py-3"
							>
								<Settings className="h-4 w-4" />
								<span>{t("userSettings")}</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CredenzaContent>
		</Credenza>
	);
}

interface CommandMenuContextType {
	open: boolean;
	setOpen: React.Dispatch<React.SetStateAction<boolean>>;
	toggleOpen: () => void;
}

const CommandMenuContext = React.createContext<
	CommandMenuContextType | undefined
>(undefined);

export function CommandMenuProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [open, setOpen] = React.useState(false);

	const toggleOpen = React.useCallback(() => {
		setOpen((prevOpen) => !prevOpen);
	}, []);

	// Handle keyboard shortcut (Cmd+K or Ctrl+K)
	React.useEffect(() => {
		const handleCommandK = (event: KeyboardEvent) => {
			if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				setOpen((prevOpen) => !prevOpen);
			}
		};

		document.addEventListener("keydown", handleCommandK);

		return () => {
			document.removeEventListener("keydown", handleCommandK);
		};
	}, []);

	const value = React.useMemo(
		() => ({
			open,
			setOpen,
			toggleOpen,
		}),
		[open, toggleOpen],
	);

	return (
		<CommandMenuContext.Provider value={value}>
			{children}
		</CommandMenuContext.Provider>
	);
}

export function useCommandMenu() {
	const context = React.useContext(CommandMenuContext);

	if (context === undefined) {
		throw new Error("useCommandMenu must be used within a CommandMenuProvider");
	}

	return context;
}
