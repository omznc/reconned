import { Breadcrumbs } from "@/app/dashboard/_components/breadcrumbs";
import { AppSidebar } from "@/app/dashboard/_components/sidebar/app-sidebar";
import { CurrentClubProvider } from "@/components/current-club-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
	children: ReactNode;
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

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

	const simplifiedClubs = clubs.map((club) => ({
		id: club.id,
		name: club.name,
		logo: club.logo,
	}));

	return (
		<SidebarProvider>
			<CurrentClubProvider>
				<AppSidebar clubs={clubs} />
				<SidebarInset className="max-h-dvh overflow-auto flex items-start p-4 justify-start">
					<Breadcrumbs clubs={simplifiedClubs} />
					{props.children}
				</SidebarInset>
			</CurrentClubProvider>
		</SidebarProvider>
	);
}
