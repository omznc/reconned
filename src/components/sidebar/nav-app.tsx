"use client";

import { getAppNavigationItems } from "@/components/sidebar/navigation-items";
import { renderExpandedItem, renderCollapsedItem } from "@/components/sidebar/utils";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function NavApp({
	isAdmin,
	pendingInvites,
}: { isAdmin: boolean; pendingInvites: number; }) {
	const path = usePathname();
	const { open: sidebarOpen, isMobile } = useSidebar();
	const t = useTranslations("components.sidebar");

	const items = getAppNavigationItems(t, isAdmin, pendingInvites);

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("dashboard")}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) =>
					sidebarOpen || isMobile
						? renderExpandedItem(item, path)
						: renderCollapsedItem(item, path),
				)}
			</SidebarMenu>
		</SidebarGroup>
	);
}
