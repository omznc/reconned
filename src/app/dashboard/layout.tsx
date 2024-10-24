import { AppSidebar } from "@/app//dashboard/_components/sidebar/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export default async function DashboardLayout(props: { children: ReactNode }) {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const clubs = await prisma.club.findMany({
		where: {
			members: {
				some: {
					userId: user.id,
				},
			},
		},
		include: {
			members: {
				where: {
					userId: user.id,
				},
			},
		},
	});

	return (
		<SidebarProvider>
			<AppSidebar clubs={clubs} />
			<SidebarInset className="max-h-dvh overflow-auto flex items-start p-4 justify-start">
				{props.children}
			</SidebarInset>
		</SidebarProvider>
	);
}
