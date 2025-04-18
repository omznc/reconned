import type { NavItem } from "@/components/sidebar/types";
import {
	Building2,
	Search,
	Pencil,
	ChartBar,
	BookUser,
	MailPlus,
	CalendarFold,
	Plus,
	CalendarDays,
	DiamondMinus,
	DollarSign,
	NotebookPen,
	Cog,
	House,
	Info,
	Key,
	LayoutDashboard,
	Mail,
	Shield,
	User,
	Bell,
} from "lucide-react";

type TFunction = (key: string, values?: Record<string, unknown>) => string;

/**
 * Get application-wide navigation items
 */
export function getAppNavigationItems(t: TFunction, isAdmin: boolean, pendingInvites: number): NavItem[] {
	const items: NavItem[] = [
		{
			title: t("home"),
			url: "/",
			icon: House,
		},
		{
			title: t("dashboard"),
			url: "/dashboard",
			icon: LayoutDashboard,
		},
		{
			title: t("help"),
			url: "/dashboard/help",
			icon: Info,
		},
		{
			title: t("user"),
			url: "#",
			icon: User,
			items: [
				{
					title: t("overview"),
					url: "/dashboard/user",
					icon: Search,
				},
				{
					title: t("settings"),
					url: "/dashboard/user/settings",
					icon: Cog,
				},
				{
					title: t("security"),
					url: "/dashboard/user/security",
					icon: Key,
				},
				{
					title: `${t("invites")} (${pendingInvites})`,
					url: "/dashboard/user/invites",
					icon: Bell,
				},
			],
		},
		{
			title: t("myEvents"),
			url: "/dashboard/events",
			icon: CalendarFold,
		},
	];

	if (isAdmin) {
		items.push({
			title: t("admin"),
			url: "#",
			icon: Shield,
			protected: true,
			items: [
				{
					title: t("users"),
					url: "/dashboard/admin/users",
					icon: User,
				},
				{
					title: t("clubs"),
					url: "/dashboard/admin/clubs",
					icon: Building2,
				},
				{
					title: t("emails"),
					url: "/dashboard/admin/emails",
					icon: Mail,
				},
			],
		});
	}

	return items;
}

/**
 * Get club-specific navigation items
 */
export function getClubNavigationItems(t: TFunction, clubId: string, isManager: boolean): NavItem[] {
	const items: NavItem[] = [
		{
			title: t("club"),
			url: "#",
			icon: Building2,
			items: [
				{
					title: t("overview"),
					url: `/dashboard/${clubId}/club`,
					icon: Search,
				},
			],
		},
	];

	// Add manager-only club items
	if (isManager && items[0]?.items) {
		items[0].items.push(
			{
				title: t("newPost"),
				url: `/dashboard/${clubId}/club/posts`,
				icon: NotebookPen,
				protected: true,
			},
			{
				title: t("spending"),
				url: `/dashboard/${clubId}/club/spending`,
				icon: DollarSign,
				protected: true,
				isNew: true,
			},
			{
				title: t("info"),
				url: `/dashboard/${clubId}/club/information`,
				icon: Pencil,
				protected: true,
			},
			{
				title: t("stats"),
				url: `/dashboard/${clubId}/club/stats`,
				icon: ChartBar,
				protected: true,
			},
		);
	}

	// Add members section
	items.push({
		title: t("members"),
		url: "#",
		icon: BookUser,
		items: [
			{
				title: t("overview"),
				url: `/dashboard/${clubId}/members`,
				icon: Search,
			},
		],
	});

	// Add manager-only member items
	if (isManager && items[1]?.items) {
		items[1].items.push(
			{
				title: t("invitations"),
				url: `/dashboard/${clubId}/members/invitations`,
				icon: MailPlus,
				protected: true,
			},
			{
				title: t("managers"),
				url: `/dashboard/${clubId}/members/managers`,
				icon: BookUser,
				protected: true,
			},
		);
	}

	// Add events section
	items.push({
		title: t("events"),
		url: "#",
		icon: CalendarFold,
		items: [
			{
				title: t("overview"),
				url: `/dashboard/${clubId}/events`,
				icon: Search,
			},
			{
				title: t("calendar"),
				url: `/dashboard/${clubId}/events/calendar`,
				icon: CalendarDays,
			},
		],
	});

	// Add manager-only event items
	if (isManager && items[2]?.items) {
		items[2].items.push(
			{
				title: t("newEvent"),
				url: `/dashboard/${clubId}/events/create`,
				icon: Plus,
				protected: true,
			},
			{
				title: t("rules"),
				url: `/dashboard/${clubId}/events/rules`,
				icon: DiamondMinus,
				isNew: true,
				protected: true,
			},
		);
	}

	return items;
}

/**
 * Convert full navigation items to flattened format (for command menu)
 */
export function flattenNavigationItems(items: NavItem[]): NavItem[] {
	const flatItems: NavItem[] = [];

	for (const item of items) {
		// Add the parent item if it has a valid URL
		if (item.url && item.url !== "#") {
			flatItems.push({ ...item, isNav: true });
		}

		// Add all sub-items
		if (item.items && item.items.length > 0) {
			for (const subItem of item.items) {
				flatItems.push({ ...subItem, isNav: true });
			}
		}
	}

	return flatItems;
}

/**
 * Helper function to extract all club navigation items as a flat list
 */
export function getClubFlatItems(t: TFunction, clubId: string, isManager: boolean): NavItem[] {
	const clubItems = getClubNavigationItems(t, clubId, isManager);
	return flattenNavigationItems(clubItems);
}
