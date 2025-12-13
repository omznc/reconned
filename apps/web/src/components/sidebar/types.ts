import type { Club } from "@generated/client";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	protected?: boolean;
	isSoon?: boolean;
	isNew?: boolean;
	items?: NavSubItem[];
	isNav?: boolean;
	shortcut?: string;
	club?: Club;
}

export interface NavSubItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	protected?: boolean;
	isSoon?: boolean;
	isNew?: boolean;
}
