import { AppSidebar } from "@/app/(club-dashboard)/dashboard/_components/sidebar/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import type { ReactNode } from "react";

export default function DashboardLayout(props: { children: ReactNode }) {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset className="max-h-dvh overflow-auto flex items-start p-4 justify-start">
				{props.children}
			</SidebarInset>
		</SidebarProvider>
	);
}
