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
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type BreadcrumbsProps = {
	clubs?: Array<{ id: string; name: string; logo: string | null }>;
};

export function Breadcrumbs({ clubs = [] }: BreadcrumbsProps) {
	const [isScrolled, setIsScrolled] = useState(false);
	const path = usePathname();
	const sections = path.split("/").filter(Boolean);

	useEffect(() => {
		const main = document.querySelector("main");
		if (!main) return;

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
				<span className="flex items-center gap-2">
					{/* {club.logo && (
						<Image
							src={club.logo}
							alt={club.name}
							width={16}
							height={16}
							className="rounded-sm object-contain"
						/>
					)} */}
					<span>{club.name}</span>
				</span>
			);
		}
		return TRANSLATIONS[section as keyof typeof TRANSLATIONS] || section;
	};

	return (
		<header
			className={cn(
				"z-10 h-10 border border-transparent flex items-center mb-4 transition-all sticky overflow-hidden top-0 bg-background/80 backdrop-blur-sm px-2 shrink-0 gap-2 ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8",
				isScrolled && "border-border",
			)}
		>
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="hidden md:flex mr-2 h-4" />
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
		</header>
	);
}

const TRANSLATIONS = {
	dashboard: "Aplikacija",
	club: "Klub",
	events: "Susreti",
	information: "Informacije",
	create: "Kreiraj",
	stats: "Statistike",
	members: "Članovi",
	settings: "Postavke",
	calendar: "Kalendar",
	invitations: "Pozivnice",
	security: "Sigurnost",
	user: "Korisnik",
	help: "Pomoć",
};
