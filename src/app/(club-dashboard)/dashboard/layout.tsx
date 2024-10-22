import { AppSidebar } from "@/components/dashboard/sidebar/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import type { ReactNode } from "react";

export default function DashboardLayout(props: { children: ReactNode }) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>{props.children}</SidebarInset>
		</SidebarProvider>
	);
}
