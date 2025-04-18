import { Breadcrumbs } from "@/components/breadcrumbs";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { CurrentClubProvider } from "@/components/current-club-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
	CommandMenu,
	CommandMenuProvider,
} from "@/components/sidebar/command-menu";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";

interface DashboardLayoutProps {
	children: ReactNode;
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
	const [user, locale] = await Promise.all([isAuthenticated(), getLocale()]);
	if (!user) {
		return redirect({ href: "/login", locale });
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

	const invitesCountForUser = await prisma.clubInvite.count({
		where: {
			email: user.email,
			status: "PENDING",
		},
	});

	const inviteRequestsCountByClub = await prisma.clubInvite
		.groupBy({
			by: ["clubId"],
			where: {
				status: "REQUESTED",
				club: {
					members: {
						some: {
							userId: user.id,
							role: {
								in: ["MANAGER", "CLUB_OWNER"],
							},
						},
					},
				},
			},
			_count: {
				_all: true,
			},
		})
		.then((results) =>
			results.map((result) => ({
				id: result.clubId,
				count: result._count._all,
			})),
		);

	return (
		<SidebarProvider>
			<CurrentClubProvider>
				<CommandMenuProvider>
					<AppSidebar
						clubs={clubs}
						user={user}
						invitesCount={invitesCountForUser}
						inviteRequestsCount={inviteRequestsCountByClub}
					/>
					<CommandMenu clubs={clubs} user={user} />
					<SidebarInset className="max-h-dvh overflow-auto flex items-center p-4 justify-start">
						<Breadcrumbs clubs={simplifiedClubs} />
						<div className="space-y-4 transition-all w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
							{props.children}
						</div>
					</SidebarInset>
				</CommandMenuProvider>
			</CurrentClubProvider>
		</SidebarProvider>
	);
}
