"use client";

import { useExtracted } from "next-intl";
import { getAppNavigationItems } from "@/components/sidebar/navigation-items";
import { renderCollapsedItem, renderExpandedItem } from "@/components/sidebar/utils";
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";

export function NavApp({ isAdmin, pendingInvites }: { isAdmin: boolean; pendingInvites: number }) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const t = useExtracted();

	const items = getAppNavigationItems(isAdmin, pendingInvites, t);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("Dashboard")}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					sidebarOpen || isMobile ? renderExpandedItem(item, path) : renderCollapsedItem(item, path),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
