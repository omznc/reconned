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
				},
			},
		},
		include: {
			events: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	const simplifiedClubs = clubs.map((club) => ({
		id: club.id,
		name: club.name,
		events: club.events,
	}));

	return (
		<SidebarProvider>
			<CurrentClubProvider>
				<AppSidebar clubs={clubs} user={user} />
				<SidebarInset className="max-h-dvh overflow-auto flex items-center p-4 justify-start">
					<Breadcrumbs clubs={simplifiedClubs} />
					<div className="space-y-4 transition-all w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
						{props.children}
					</div>
				</SidebarInset>
			</CurrentClubProvider>
		</SidebarProvider>
	);
}
