import type { LucideIcon } from "lucide-react";
import type { ApiResponse } from "@/lib/api";

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
	club?: Omit<ApiResponse<"/api/dashboard/clubs", "get">["clubs"], "reviews" | "posts" | "_count">[number];
}

export interface NavSubItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	protected?: boolean;
	isSoon?: boolean;
	isNew?: boolean;
}
