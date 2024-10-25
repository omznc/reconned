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

type BreadcrumbsProps = {};

export function Breadcrumbs(props: BreadcrumbsProps) {
	const path = usePathname();
	const sections = path.split("/").filter(Boolean);
	return (
		<header className="z-10 h-10 flex items-center mb-4 transition-all sticky overflow-hidden top-0 bg-background/80 backdrop-blur-sm border px-2 shrink-0 gap-2 ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8">
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="hidden md:flex mr-2 h-4" />
				<Breadcrumb className="hidden md:flex overflow-x-scroll whitespace-nowrap flex-nowrap">
					<BreadcrumbList>
						{sections.map((section, index) => (
							<>
								<BreadcrumbItem key={`breadcrumb-${section}-${index}`}>
									<BreadcrumbLink
										className="truncate"
										href={`/${sections.slice(0, index + 1).join("/")}`}
									>
										{TRANSLATIONS[section as keyof typeof TRANSLATIONS] ||
											section}
									</BreadcrumbLink>
								</BreadcrumbItem>
								{index < sections.length - 1 && (
									<BreadcrumbSeparator
										key={`breadcrumb-separator-${section}-${index}`}
									/>
								)}
							</>
						))}
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
};
