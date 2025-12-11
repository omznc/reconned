"use client";

import type { Club } from "@generated/client";
import type { User } from "better-auth";
import Fuse from "fuse.js";
import { Building2, Settings, Square } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import {
	createContext,
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useCurrentClub } from "@/components/current-club-provider";
import { flattenNavigationItems, getAppNavigationItems, getClubFlatItems } from "@/components/sidebar/navigation-items";
import type { NavItem } from "@/components/sidebar/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Credenza, CredenzaContent, CredenzaTitle, CredenzaTrigger } from "@/components/ui/credenza";
import { useRouter } from "@/i18n/navigation";

interface CommandMenuProps {
	clubs: Club[];
	user: User & { managedClubs: string[]; role?: string | null | undefined };
}

export function CommandMenu({ clubs, user }: CommandMenuProps) {
	const { open, setOpen } = useCommandMenu();
	const [search, setSearch] = useState("");
	const router = useRouter();
	const { clubId } = useCurrentClub();
	const t = useExtracted();
	const inputRef = useRef<HTMLInputElement>(null);

	const overviewTitle = useMemo(() => t("Overview"), [t]);

	const sectionTitleMap = useMemo(
		() => ({
			dashboard: t("Dashboard"),
			help: t("Help"),
			user: t("User"),
			settings: t("Settings"),
			security: t("Security"),
			invites: t("Invitations"),
			"add-club": t("Add club"),
			club: t("Club"),
			clubs: t("Clubs"),
			information: t("Information"),
			stats: t("Statistics"),
			spending: t("Expenses"),
			members: t("Members"),
			invitations: t("Invitations"),
			managers: t("Managers"),
			events: t("Events"),
			calendar: t("Calendar"),
			rules: t("Rules"),
			admin: t("Administration"),
			audit: t("Audit"),
			emails: t("Emails"),
			users: t("Users"),
			"unclaimed-clubs": t("Unclaimed clubs"),
			posts: t("New post"),
		}),
		[t],
	);

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

	// Determine if this is an overview item and which section it belongs to
	function getDisplayTitle(item: NavItem): string {
		// If the title is "overview" and it has a club and the URL contains a section identifier
		if (item.title.toLowerCase() === overviewTitle.toLowerCase() && item.url) {
			// Extract section from URL pattern like /dashboard/{clubId}/{section} or /dashboard/{section}
			const urlParts = item.url.split("/").filter(Boolean);
			if (urlParts.length >= 2) {
				// For club-specific overview pages
				if (urlParts[0] === "dashboard" && urlParts[1] === item.club?.id) {
					// The section is the part after the clubId
					const section = urlParts[2];
					if (section) {
						const sectionLabel = sectionTitleMap[section as keyof typeof sectionTitleMap];
						return `${overviewTitle} - ${sectionLabel ?? section}`;
					}
				}
				// For general overview pages
				else if (urlParts[0] === "dashboard") {
					const section = urlParts[1];
					if (section) {
						const sectionLabel = sectionTitleMap[section as keyof typeof sectionTitleMap];
						return `${overviewTitle} - ${sectionLabel ?? section}`;
					}
				}
			}
		}
		return item.title;
	}

	// Generate all navigation items using our centralized functions
	const allItems = useMemo(() => {
		// App navigation items
		const appItems = getAppNavigationItems(user.role === "admin", 0, t);
		const flatAppItems = flattenNavigationItems(appItems);

		// Club-specific items for each club
		let clubItems: NavItem[] = [];
		for (const club of clubs) {
			const isManager = user?.managedClubs?.includes(club.id);
			const items = getClubFlatItems(club.id, isManager, t);
			// Add club information to each item
			const itemsWithClub = items.map((item) => ({ ...item, club }));
			clubItems = [...clubItems, ...itemsWithClub];
		}

		// Create enhanced items with display titles for search
		const enhancedItems = [...flatAppItems, ...clubItems].map((item) => {
			const displayTitle = getDisplayTitle(item);
			return {
				...item,
				displayTitle,
			};
		});

		return enhancedItems;
	}, [clubs, clubId, t, user.managedClubs, user.role]);

	// Fuse.js setup for fuzzy search
	const fuse = useMemo(() => {
		return new Fuse(allItems, {
			keys: ["title", "displayTitle", "club.name", "club.url"],
			threshold: 0.6,
			ignoreDiacritics: true,
		});
	}, [allItems]);

	// Filter items based on search
	const filteredItems = useMemo(() => {
		if (!search) {
			return allItems;
		}

		return fuse.search(search).map((result) => result.item);
	}, [fuse, search]);

	// Group filtered items - fix items with both isNav and club properties
	const navItems = filteredItems.filter((item) => item.isNav && !item.club);
	const clubItems = filteredItems.filter((item) => !!item.club);

	useEffect(() => {
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
	useEffect(() => {
		if (open && inputRef.current) {
			setTimeout(() => {
				inputRef.current?.focus();
			}, 0);
		}
	}, [open]);

	// Reset search when dialog closes
	useEffect(() => {
		if (!open) {
			setSearch("");
		}
	}, [open]);

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger className="hidden">{null}</CredenzaTrigger>
			<CredenzaContent className="p-0 overflow-hidden">
				<CredenzaTitle className="sr-only">{t("Search...")}</CredenzaTitle>
				<Command>
					<CommandInput
						ref={inputRef}
						placeholder={t("Search...")}
						value={search}
						onValueChange={setSearch}
						className="border-none focus:ring-0"
					/>
					<CommandList className="overflow-y-auto overflow-x-hidden">
						<CommandEmpty>{t("No results found.")}</CommandEmpty>
						{/* User navigation section */}
						{navItems.length > 0 && (
							<CommandGroup heading={t("Navigation")}>
								{navItems.map((item) => (
									<CommandItem
										key={item.url}
										onSelect={() => handleCommand(item.url)}
										className="flex items-center gap-3 py-3"
									>
										<div className="flex items-center gap-3 flex-1">
											{item.icon && <item.icon className="h-4 w-4" />}
											<span>{getDisplayTitle(item)}</span>
										</div>
										{item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{/* Clubs section */}
						<CommandGroup heading={t("Clubs")}>
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
								<CommandGroup heading={t("Navigation")}>
									{clubItems.map((item) => (
										<CommandItem
											key={item.url}
											onSelect={() => handleCommand(item.url)}
											className="flex items-center py-3"
										>
											<div className="flex items-center gap-3 flex-1">
												{item.icon && <item.icon className="h-4 w-4" />}
												<span>{getDisplayTitle(item)}</span>
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
						<CommandGroup heading={t("Account")}>
							<CommandItem
								onSelect={() => handleCommand("/dashboard/user")}
								className="flex items-center gap-3 py-3"
							>
								<div className="flex h-7 w-7 items-center justify-center">
									<Avatar className="h-7 w-7">
										{user?.image && <AvatarImage src={user.image} alt={user?.name || ""} />}
										<AvatarFallback>{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
									</Avatar>
								</div>
								<div className="flex flex-col">
									<span className="font-medium">{user?.name}</span>
									<span className="text-xs text-muted-foreground">{user?.email}</span>
								</div>
							</CommandItem>
							<CommandItem
								onSelect={() => handleCommand("/dashboard/user/settings")}
								className="flex items-center gap-3 py-3"
							>
								<Settings className="h-4 w-4" />
								<span>{t("User Settings")}</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</CredenzaContent>
		</Credenza>
	);
}

// CommandMenuContext and related code
interface CommandMenuContextType {
	open: boolean;
	setOpen: Dispatch<SetStateAction<boolean>>;
	toggleOpen: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextType | undefined>(undefined);

export function CommandMenuProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);

	const toggleOpen = useCallback(() => {
		setOpen((prevOpen) => !prevOpen);
	}, []);

	// Handle keyboard shortcut (Cmd+K or Ctrl+K)
	useEffect(() => {
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

	const value = useMemo(
		() => ({
			open,
			setOpen,
			toggleOpen,
		}),
		[open, toggleOpen],
	);

	return <CommandMenuContext.Provider value={value}>{children}</CommandMenuContext.Provider>;
}

export function useCommandMenu() {
	const context = useContext(CommandMenuContext);

	if (context === undefined) {
		throw new ActionError("useCommandMenu must be used within a CommandMenuProvider");
	}

	return context;
}
