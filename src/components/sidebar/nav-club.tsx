"use client";

import type { User } from "better-auth";
import { useTranslations } from "next-intl";
import { useCurrentClub } from "@/components/current-club-provider";
import { getClubNavigationItems } from "@/components/sidebar/navigation-items";
import { renderCollapsedItem, renderExpandedItem } from "@/components/sidebar/utils";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";

interface NavClubProps {
	user: User & { managedClubs: string[] };
}

export function NavClub({ user }: NavClubProps) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const { clubId } = useCurrentClub();
	const t = useTranslations();

	if (!clubId) {
		return null;
	}

	const isManager = user?.managedClubs?.includes(clubId);
	const items = getClubNavigationItems(clubId, isManager, t);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("components.sidebar.myClub")}</SidebarGroupLabel>
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
