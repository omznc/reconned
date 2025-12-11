import {
	Bell,
	BookUser,
	Building2,
	CalendarDays,
	CalendarFold,
	Cog,
	DiamondMinus,
	DollarSign,
	History,
	House,
	Info,
	Key,
	LayoutDashboard,
	Mail,
	MailPlus,
	NotebookPen,
	Pencil,
	Plus,
	Search,
	Shield,
	User,
} from "lucide-react";
import type { NavItem } from "@/components/sidebar/types";

/**
 * Get application-wide navigation items
 */
export function getAppNavigationItems(isAdmin: boolean, pendingInvites: number, t: (key: string) => string): NavItem[] {
	const items: NavItem[] = [
		{
			title: t("Homepage"),
			url: "/",
			icon: House,
		},
		{
			title: t("Dashboard"),
			url: "/dashboard",
			icon: LayoutDashboard,
		},
		{
			title: t("Help"),
			url: "/dashboard/help",
			icon: Info,
		},
		{
			title: t("User"),
			url: "#",
			icon: User,
			items: [
				{
					title: t("Overview"),
					url: "/dashboard/user",
					icon: Search,
				},
				{
					title: t("Settings"),
					url: "/dashboard/user/settings",
					icon: Cog,
				},
				{
					title: t("Security"),
					url: "/dashboard/user/security",
					icon: Key,
				},
				{
					title: `${t("Invitations")} (${pendingInvites})`,
					url: "/dashboard/user/invites",
					icon: Bell,
				},
			],
		},
		{
			title: t("My events"),
			url: "/dashboard/events",
			icon: CalendarFold,
		},
	];

	if (isAdmin) {
		items.push({
			title: t("Administration"),
			url: "#",
			icon: Shield,
			protected: true,
			items: [
				{
					title: t("Users"),
					url: "/dashboard/admin/users",
					icon: User,
				},
				{
					title: t("Clubs"),
					url: "/dashboard/admin/clubs",
					icon: Building2,
				},
				{
					title: t("Unclaimed clubs"),
					url: "/dashboard/admin/unclaimed-clubs",
					icon: Building2,
				},
				{
					title: t("Emails"),
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
export function getClubNavigationItems(clubId: string, isManager: boolean, t: (key: string) => string): NavItem[] {
	const items: NavItem[] = [
		{
			title: t("Club"),
			url: "#",
			icon: Building2,
			items: [
				{
					title: t("Overview"),
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
				title: t("New post"),
				url: `/dashboard/${clubId}/club/posts`,
				icon: NotebookPen,
				protected: true,
			},
			{
				title: t("Expenses"),
				url: `/dashboard/${clubId}/club/spending`,
				icon: DollarSign,
				protected: true,
			},
			{
				title: t("Information"),
				url: `/dashboard/${clubId}/club/information`,
				icon: Pencil,
				protected: true,
			},
			// {
			// 	title: t("Statistics"),
			// 	url: `/dashboard/${clubId}/club/stats`,
			// 	icon: ChartBar,
			// 	protected: true,
			// },
			{
				title: t("Audit"),
				url: `/dashboard/${clubId}/club/audit`,
				icon: History,
				protected: true,
			},
		);
	}

	// Add members section
	items.push({
		title: t("Members"),
		url: "#",
		icon: BookUser,
		items: [
			{
				title: t("Overview"),
				url: `/dashboard/${clubId}/members`,
				icon: Search,
			},
		],
	});

	// Add manager-only member items
	if (isManager && items[1]?.items) {
		items[1].items.push(
			{
				title: t("Invitations"),
				url: `/dashboard/${clubId}/members/invitations`,
				icon: MailPlus,
				protected: true,
			},
			{
				title: t("Managers"),
				url: `/dashboard/${clubId}/members/managers`,
				icon: BookUser,
				protected: true,
			},
		);
	}

	// Add events section
	items.push({
		title: t("Events"),
		url: "#",
		icon: CalendarFold,
		items: [
			{
				title: t("Overview"),
				url: `/dashboard/${clubId}/events`,
				icon: Search,
			},
			{
				title: t("Calendar"),
				url: `/dashboard/${clubId}/events/calendar`,
				icon: CalendarDays,
			},
		],
	});

	// Add manager-only event items
	if (isManager && items[2]?.items) {
		items[2].items.push(
			{
				title: t("Create an event"),
				url: `/dashboard/${clubId}/events/create`,
				icon: Plus,
				protected: true,
			},
			{
				title: t("Rules"),
				url: `/dashboard/${clubId}/events/rules`,
				icon: DiamondMinus,
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
export function getClubFlatItems(clubId: string, isManager: boolean, t: (key: string) => string): NavItem[] {
	const clubItems = getClubNavigationItems(clubId, isManager, t);
	return flattenNavigationItems(clubItems);
}
