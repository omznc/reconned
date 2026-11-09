import { createFileRoute, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ClubsProvider } from "@/components/clubs-provider";
import { CurrentClubProvider } from "@/components/current-club-provider";
import { ErrorPage } from "@/components/error-page";
import { NotFoundPage } from "@/components/not-found-page";
import { RouteErrorPage } from "@/components/route-error-page";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { CommandMenu, CommandMenuProvider } from "@/components/sidebar/command-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";

// Both counts only drive badges, so a failed count endpoint degrades to "nothing to show".
async function fetchInvitesCount(): Promise<number> {
	try {
		const { data, error } = await apiServer.GET("/api/users/invites/count");
		return error || !data ? 0 : data.count || 0;
	} catch {
		return 0;
	}
}

async function fetchInviteRequestsCount(): Promise<Array<{ id: string; count: number }>> {
	try {
		const { data, error } = await apiServer.GET("/api/dashboard/invite-requests-count");
		return error || !data ? [] : data.clubs.map((item) => ({ id: item.id, count: item.count }));
	} catch {
		return [];
	}
}

const getDashboardShellFn = createServerFn({ method: "GET" }).handler(async () => {
	const [clubsResponse, invitesCount, inviteRequestsCount] = await Promise.all([
		apiServer.GET("/api/dashboard/clubs"),
		fetchInvitesCount(),
		fetchInviteRequestsCount(),
	]);

	if (clubsResponse.error || !clubsResponse.data) {
		return null;
	}

	return { clubs: clubsResponse.data.clubs, invitesCount, inviteRequestsCount };
});

export const Route = createFileRoute("/{-$locale}/dashboard")({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw redirect({ href: "/login?redirectTo=/dashboard", locale: context.locale });
		}
		return { user: context.user };
	},
	loader: () => getDashboardShellFn(),
	head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
	component: DashboardLayout,
	errorComponent: RouteErrorPage,
	notFoundComponent: NotFoundPage,
});

function DashboardLayout() {
	const t = useExtracted();
	const shell = Route.useLoaderData();
	const { user } = Route.useRouteContext();

	if (!shell) {
		return <ErrorPage title={t("An error occurred")} />;
	}

	const simplifiedClubs = shell.clubs.map((club) => ({
		id: club.id,
		name: club.name,
		events: club.events?.map((event) => ({ id: event.id, name: event.name })) || [],
	}));

	return (
		<SidebarProvider defaultOpen={true}>
			<ClubsProvider initialClubs={shell.clubs}>
				<CurrentClubProvider>
					<CommandMenuProvider>
						<AppSidebar
							user={user}
							invitesCount={shell.invitesCount}
							inviteRequestsCount={shell.inviteRequestsCount}
						/>
						<CommandMenu user={user} />
						<SidebarInset className="relative flex flex-col items-center p-4">
							<div className="absolute top-0 left-0 right-0 z-10 h-[400px] rounded-md bg-linear-to-b from-red-600/20 to-transparent pointer-events-none" />
							<Breadcrumbs clubs={simplifiedClubs} />
							<div className="relative z-20 space-y-4 transition-all w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl">
								<Outlet />
							</div>
						</SidebarInset>
					</CommandMenuProvider>
				</CurrentClubProvider>
			</ClubsProvider>
		</SidebarProvider>
	);
}
