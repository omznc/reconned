"use client";

import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Building2Icon, CalendarFoldIcon } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";

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
	const [isScrolled, setIsScrolled] = useState(false);
	const path = usePathname();
	const sections = path.split("/").filter(Boolean);
	const t = useTranslations("components.breadcrumbs");

	useEffect(() => {
		const main = document.querySelector("main");
		if (!main) {
			return;
		}

		const handleScroll = () => {
			setIsScrolled(main.scrollTop > 0);
		};

		main.addEventListener("scroll", handleScroll);
		return () => main.removeEventListener("scroll", handleScroll);
	}, []);

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
						<p>{t("currentClub")}</p>
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
						<p>{t("currentEvent")}</p>
					</TooltipContent>
				</Tooltip>
			);
		}

		return t(`translations.${section}`) || section;
	};

	return (
		<div className="sticky top-0 w-full z-10">
			<header
				className={cn(
					"z-10 h-10 w-fit border border-transparent flex items-center mb-4 transition-all bg-background/80 backdrop-blur-sm px-2 shrink-0 gap-2 ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8",
					isScrolled && "border-border",
				)}
			>
				<TooltipProvider>
					<div className="flex items-center gap-2">
						<SidebarTrigger className="-ml-1" />
						<Separator
							orientation="vertical"
							className="hidden md:flex mr-2 h-4"
						/>
						<Breadcrumb className="hidden md:flex overflow-x-scroll whitespace-nowrap flex-nowrap">
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
												<BreadcrumbSeparator
													key={`breadcrumb-separator-${sectionKey}`}
												/>
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
