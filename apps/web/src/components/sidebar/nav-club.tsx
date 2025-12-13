"use client";

import type { User } from "better-auth";
import { useExtracted } from "next-intl";
import { useClubNavigationItems } from "@/components/sidebar/navigation-items";
import { renderCollapsedItem, renderExpandedItem } from "@/components/sidebar/utils";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";

interface NavClubProps {
	user: User & { managedClubs: string[] };
	clubId: string;
}

export function NavClub({ user, clubId }: NavClubProps) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const t = useExtracted();
	const isManager = user?.managedClubs?.includes(clubId);
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
