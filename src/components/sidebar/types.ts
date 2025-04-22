import type { LucideIcon } from "lucide-react";
import type { Club } from "@prisma/client";

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
