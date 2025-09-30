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
			title: t("components.sidebar.home"),
			url: "/",
			icon: House,
		},
		{
			title: t("components.sidebar.dashboard"),
			url: "/dashboard",
			icon: LayoutDashboard,
		},
		{
			title: t("components.sidebar.help"),
			url: "/dashboard/help",
			icon: Info,
		},
		{
			title: t("components.sidebar.user"),
			url: "#",
			icon: User,
			items: [
				{
					title: t("components.sidebar.overview"),
					url: "/dashboard/user",
					icon: Search,
				},
				{
					title: t("components.sidebar.settings"),
					url: "/dashboard/user/settings",
					icon: Cog,
				},
				{
					title: t("components.sidebar.security"),
					url: "/dashboard/user/security",
					icon: Key,
				},
				{
					title: `${t("components.sidebar.invites")} (${pendingInvites})`,
					url: "/dashboard/user/invites",
					icon: Bell,
				},
			],
		},
		{
			title: t("components.sidebar.myEvents"),
			url: "/dashboard/events",
			icon: CalendarFold,
		},
	];

	if (isAdmin) {
		items.push({
			title: t("components.sidebar.admin"),
			url: "#",
			icon: Shield,
			protected: true,
			items: [
				{
					title: t("components.sidebar.users"),
					url: "/dashboard/admin/users",
					icon: User,
				},
				{
					title: t("components.sidebar.clubs"),
					url: "/dashboard/admin/clubs",
					icon: Building2,
				},
				{
					title: t("components.sidebar.emails"),
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
			title: t("components.sidebar.club"),
			url: "#",
			icon: Building2,
			items: [
				{
					title: t("components.sidebar.overview"),
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
				title: t("components.sidebar.newPost"),
				url: `/dashboard/${clubId}/club/posts`,
				icon: NotebookPen,
				protected: true,
			},
			{
				title: t("components.sidebar.spending"),
				url: `/dashboard/${clubId}/club/spending`,
				icon: DollarSign,
				protected: true,
			},
			{
				title: t("components.sidebar.info"),
				url: `/dashboard/${clubId}/club/information`,
				icon: Pencil,
				protected: true,
			},
			// {
			// 	title: t("components.sidebar.stats"),
			// 	url: `/dashboard/${clubId}/club/stats`,
			// 	icon: ChartBar,
			// 	protected: true,
			// },
			{
				title: t("components.sidebar.auditLogs"),
				url: `/dashboard/${clubId}/club/audit`,
				icon: History,
				protected: true,
			},
		);
	}

	// Add members section
	items.push({
		title: t("components.sidebar.members"),
		url: "#",
		icon: BookUser,
		items: [
			{
				title: t("components.sidebar.overview"),
				url: `/dashboard/${clubId}/members`,
				icon: Search,
			},
		],
	});

	// Add manager-only member items
	if (isManager && items[1]?.items) {
		items[1].items.push(
			{
				title: t("components.sidebar.invitations"),
				url: `/dashboard/${clubId}/members/invitations`,
				icon: MailPlus,
				protected: true,
			},
			{
				title: t("components.sidebar.managers"),
				url: `/dashboard/${clubId}/members/managers`,
				icon: BookUser,
				protected: true,
			},
		);
	}

	// Add events section
	items.push({
		title: t("components.sidebar.events"),
		url: "#",
		icon: CalendarFold,
		items: [
			{
				title: t("components.sidebar.overview"),
				url: `/dashboard/${clubId}/events`,
				icon: Search,
			},
			{
				title: t("components.sidebar.calendar"),
				url: `/dashboard/${clubId}/events/calendar`,
				icon: CalendarDays,
			},
		],
	});

	// Add manager-only event items
	if (isManager && items[2]?.items) {
		items[2].items.push(
			{
				title: t("components.sidebar.newEvent"),
				url: `/dashboard/${clubId}/events/create`,
				icon: Plus,
				protected: true,
			},
			{
				title: t("components.sidebar.rules"),
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
