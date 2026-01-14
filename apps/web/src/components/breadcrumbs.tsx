"use client";

import { Building2Icon, CalendarFoldIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BreadcrumbsProps = {
	clubs?: Array<{
		id: string;
		name: string;
		events: Array<{
			id: string;
			name: string;
		}>;
	}>;
};

export function Breadcrumbs({ clubs = [] }: BreadcrumbsProps) {
	const path = usePathname();
	const sections = path.split("/").filter(Boolean);
	const t = useExtracted();

	const breadcrumbsTranslations = {
		dashboard: t("Dashboard"),
		club: t("Club"),
		clubs: t("Clubs"),
		events: t("Events"),
		information: t("Information"),
		create: t("Create"),
		stats: t("Statistics"),
		members: t("Members"),
		settings: t("Settings"),
		calendar: t("Calendar"),
		invitations: t("Invitations"),
		security: t("Security"),
		user: t("User"),
		help: t("Help"),
		managers: t("Managers"),
		rules: t("Rules"),
		attendance: t("Attendance"),
		admin: t("Administration"),
		posts: t("New post"),
		spending: t("Spending"),
		"add-club": t("Add club"),
		audit: t("Audit"),
		invites: t("Invitations"),
		users: t("Users"),
		instagram: t("Instagram"),
		"unclaimed-clubs": t("Unclaimed clubs"),
		edit: t("Edit"),
		tasks: t("Tasks"),
		alliances: t("Alliances"),
		featureFlags: t("Feature flags"),
	};

	const getDisplayText = (section: string) => {
		// Check if section is a club ID
		const club = clubs.find((c) => c.id === section);
		if (club) {
			return (
				<Tooltip delayDuration={0}>
					<TooltipTrigger asChild>
						<span className="flex items-center gap-2">
							<Building2Icon className="w-4 h-4" />
							<span>{club.name}</span>
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<p>{t("Current club")}</p>
					</TooltipContent>
				</Tooltip>
			);
		}

		// Check if section is an event ID
		const event = clubs.flatMap((c) => c.events).find((e) => e.id === section);
		if (event) {
			return (
				<Tooltip delayDuration={0}>
					<TooltipTrigger asChild>
						<span className="flex items-center gap-2">
							<CalendarFoldIcon className="w-4 h-4" />
							<span>{event.name}</span>
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<p>{t("Current event")}</p>
					</TooltipContent>
				</Tooltip>
			);
		}

		try {
			const resp = breadcrumbsTranslations[section as keyof typeof breadcrumbsTranslations];
			return resp || section;
		} catch {
			return section;
		}
	};

	return (
		<div className="sticky top-4 left-4 w-full z-10 mb-4">
			<header
				className={cn(
					"z-10 h-10 w-fit border border-border rounded-md flex items-center transition-all bg-background/80 backdrop-blur-xs px-2 shrink-0 gap-2 ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-8",
				)}
			>
				<TooltipProvider>
					<div className="flex items-center gap-2">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="hidden md:flex mr-2 h-4" />
						<Breadcrumb className="hidden md:flex overflow-hidden whitespace-nowrap flex-nowrap">
							<BreadcrumbList>
								{sections.map((section, index) => {
									const sectionKey = `${section}-${index}-${sections.slice(0, index + 1).join("/")}`;
									return (
										<Fragment key={sectionKey}>
											<BreadcrumbItem key={`breadcrumb-${sectionKey}`}>
												<BreadcrumbLink
													className="truncate"
													href={`/${sections.slice(0, index + 1).join("/")}`}
												>
													{getDisplayText(section)}
												</BreadcrumbLink>
											</BreadcrumbItem>
											{index < sections.length - 1 && (
												<BreadcrumbSeparator key={`breadcrumb-separator-${sectionKey}`} />
											)}
										</Fragment>
									);
								})}
							</BreadcrumbList>
						</Breadcrumb>
					</div>
				</TooltipProvider>
			</header>
		</div>
	);
}

// "translations": {
// 				"dashboard": "Dashboard",
// 				"club": "Club",
// 				"clubs": "Clubs",
// 				"events": "Events",
// 				"information": "Information",
// 				"create": "Create",
// 				"stats": "Statistics",
// 				"members": "Members",
// 				"settings": "Settings",
// 				"calendar": "Calendar",
// 				"invitations": "Invitations",
// 				"security": "Security",
// 				"user": "User",
// 				"help": "Help",
// 				"managers": "Managers",
// 				"rules": "Rules",
// 				"attendance": "Attendance",
// 				"admin": "Administration",
// 				"emails": "Emails",
// 				"posts": "New post",
// 				"spending": "Spending",
// 				"add-club": "Add club",
// 				"audit": "Audit",
// 				"invites": "Invitations",
// 				"users": "Users",
// 				"instagram": "Instagram",
// 				"unclaimed-clubs": "Unclaimed clubs",
// 				"edit": "Edit"
// 			}
