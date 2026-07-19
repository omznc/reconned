import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClubsProvider } from "@/components/clubs-provider";
import { CurrentClubProvider } from "@/components/current-club-provider";
import { ErrorPage } from "@/components/error-page";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { CommandMenu, CommandMenuProvider } from "@/components/sidebar/command-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

interface DashboardLayoutProps {
	children: ReactNode;
}

export const metadata: Metadata = {
	robots: {
		index: false,
		follow: false,
	},
};

export default async function DashboardLayout(props: DashboardLayoutProps) {
	const [user, locale] = await Promise.all([isAuthenticated(), getLocale()]);
	const t = await getTranslations();

	if (!user) {
		return redirect({ href: "/login?redirectTo=/dashboard", locale });
	}

	// All three are independent, so they are started together. Only the clubs response is awaited
	// here: it gates the error page and feeds every provider below it. The two counts are handed to
	// the sidebar as promises and awaited inside its Suspense boundaries, so a slow count endpoint
	// no longer delays the sidebar, the breadcrumbs or `children`.
	const clubsRequest = apiServer.GET("/api/dashboard/clubs");
	const invitesCountRequest = apiServer.GET("/api/users/invites/count");
	const inviteRequestsRequest = apiServer.GET("/api/dashboard/invite-requests-count");

	// Both counts degrade to "nothing to show" on failure, matching the previous behaviour — these
	// are badges, and an unreachable count endpoint should never take the dashboard down. The
	// `.catch` also stops a rejection from surfacing as an unhandled promise rejection.
	const invitesCountPromise = invitesCountRequest
		.then(({ data, error }) => (error || !data ? 0 : data.count || 0))
		.catch(() => 0);

	const inviteRequestsCountPromise = inviteRequestsRequest
		.then(({ data, error }) =>
			error || !data ? [] : data.clubs.map((item) => ({ id: item.id, count: item.count })),
		)
		.catch(() => []);

	const { data: clubsData, error: clubsError } = await clubsRequest;

	if (clubsError || !clubsData) {
		return <ErrorPage title={t("An error occurred")} />;
	}

	const clubs = clubsData.clubs.map((club) => ({
		id: club.id,
		name: club.name,
		events:
			club.events?.map((event) => ({
				id: event.id,
				name: event.name,
			})) || [],
	}));

	const simplifiedClubs = clubs.map((club) => ({
		id: club.id,
		name: club.name,
		events: club.events,
	}));

	return (
		<SidebarProvider defaultOpen={true}>
			<ClubsProvider initialClubs={clubsData.clubs}>
				<CurrentClubProvider>
					<CommandMenuProvider>
						<AppSidebar
							user={user}
							invitesCountPromise={invitesCountPromise}
							inviteRequestsCountPromise={inviteRequestsCountPromise}
						/>
						<CommandMenu user={user} />
						<SidebarInset className="relative flex flex-col items-center p-4">
							<div className="absolute top-0 left-0 right-0 z-10 h-[400px] rounded-md bg-linear-to-b from-red-600/20 to-transparent pointer-events-none" />
							<Breadcrumbs clubs={simplifiedClubs} />
							<div className="relative z-20 space-y-4 transition-all w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
								{props.children}
							</div>
						</SidebarInset>
					</CommandMenuProvider>
				</CurrentClubProvider>
			</ClubsProvider>
		</SidebarProvider>
	);
}
