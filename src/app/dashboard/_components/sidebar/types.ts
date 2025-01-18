import type { LucideIcon } from "lucide-react";

export interface NavItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	protected?: boolean;
	isSoon?: boolean;
	items?: NavSubItem[];
}

export interface NavSubItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	protected?: boolean;
	isSoon?: boolean;
}

export interface NavSectionProps {
	title: string;
	items: NavItem[];
	filter?: (item: NavItem) => boolean;
}
