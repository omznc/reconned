import { getLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CurrentClubProvider } from "@/components/current-club-provider";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { CommandMenu, CommandMenuProvider } from "@/components/sidebar/command-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import apiClient from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

interface DashboardLayoutProps {
	children: ReactNode;
}

export default async function DashboardLayout(props: DashboardLayoutProps) {
	const [user, locale] = await Promise.all([isAuthenticated(), getLocale()]);
	if (!user) {
		return redirect({ href: "/login", locale });
	}

	const { data: clubsData, error: clubsError } = await apiClient.GET("/api/dashboard/clubs");

	if (clubsError || !clubsData) {
		return redirect({ href: "/login", locale });
	}

	const clubs = clubsData.clubs.map((club) => ({
		id: club.id,
		name: club.name,
		events:
			club.events?.map((event) => ({
				id: event.id,
				name: event.name,
			})) ?? [],
	}));

	const simplifiedClubs = clubs.map((club) => ({
		id: club.id,
		name: club.name,
		events: club.events,
	}));

	const { data: invitesCountData, error: invitesCountError } = await apiClient.GET("/api/users/invites/count");
	const invitesCountForUser = invitesCountError || !invitesCountData ? 0 : (invitesCountData.count ?? 0);

	const { data: inviteRequestsData, error: inviteRequestsError } = await apiClient.GET(
		"/api/dashboard/invite-requests-count",
	);

	const inviteRequestsCountByClub =
		inviteRequestsError || !inviteRequestsData
			? []
			: inviteRequestsData.clubs.map((item) => ({
					id: item.id,
					count: item.count,
				}));

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
					<SidebarInset className="relative flex flex-col p-4">
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
