"use client";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";
import { useCurrentClub } from "@/components/current-club-provider";
import type { User } from "better-auth";
import {
	renderCollapsedItem,
	renderExpandedItem,
} from "@/components/sidebar/utils";
import { useTranslations } from "next-intl";
import { getClubNavigationItems } from "@/components/sidebar/navigation-items";

interface NavClubProps {
	user: User & { managedClubs: string[] };
}

export function NavClub({ user }: NavClubProps) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const { clubId } = useCurrentClub();
	const t = useTranslations("components.sidebar");

	if (!clubId) {
		return null;
	}

	const isManager = user?.managedClubs?.includes(clubId);
	const items = getClubNavigationItems(t, clubId, isManager);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("myClub")}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					sidebarOpen || isMobile
						? renderExpandedItem(item, path, {
								hasAccess: (subItem) =>
									!subItem.protected || (subItem.protected && isManager),
							})
						: renderCollapsedItem(item, path),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
