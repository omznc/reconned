"use client";

import { useExtracted } from "next-intl";
import { useClubNavigationItems } from "@/components/sidebar/navigation-items";
import { renderCollapsedItem, renderExpandedItem } from "@/components/sidebar/utils";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type DashboardClubs = ApiResponse<"/api/dashboard/clubs", "get">["clubs"];

interface NavClubProps {
	clubId: string;
	clubs: DashboardClubs;
}

export function NavClub({ clubId, clubs }: NavClubProps) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const t = useExtracted();
	const club = clubs.find((c) => c.id === clubId);
	const role = club?.membershipRole;
	const isManager = role === "MANAGER" || role === "CLUB_OWNER";
	const items = useClubNavigationItems(clubId, isManager);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("My club")}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					sidebarOpen || isMobile
						? renderExpandedItem(item, path, {
								hasAccess: (subItem) => !subItem.protected || (subItem.protected && isManager),
							})
						: renderCollapsedItem(item, path),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
