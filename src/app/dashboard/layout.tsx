import { AppSidebar } from "@/app/dashboard/_components/sidebar/app-sidebar";
import DotPattern from "@/components/ui/dot-pattern";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
	children: ReactNode;
	params: Promise<{
		clubId: string;
	}>;
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}
	const params = await props.params;

	const clubs = await prisma.club.findMany({
		where: {
			members: {
				some: {
					userId: user.id,
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
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
				{/* <Breadcrumbs /> TODO: Fix hydration errors */}
				<DotPattern className="fixed z-0 opacity-20 size-full" />
				{props.children}
			</SidebarInset>
		</SidebarProvider>
	);
}
