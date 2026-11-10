import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { toIntlLocale } from "@/lib/intl-locale";

const getDashboardStatsFn = createServerFn({ method: "GET" })
	.validator(z.object({ userId: z.string() }))
	.handler(async ({ data }) => {
		const { data: stats, error } = await apiServer.GET("/api/users/{id}/stats", {
			params: { path: { id: data.userId } },
		});
		return error || !stats ? null : stats;
	});

export const Route = createFileRoute("/{-$locale}/dashboard/")({
	loader: ({ context }) => getDashboardStatsFn({ data: { userId: context.user.id } }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: DashboardPage,
});

function DashboardPage() {
	const t = useExtracted();
	const stats = Route.useLoaderData();
	const { user } = Route.useRouteContext();

	if (!stats) {
		return <ErrorPage title={t("An error occurred")} />;
	}

	const userWithDetails = {
		clubMembership: stats.clubMembershipDetails || [],
		eventRegistration: stats.eventRegistrationDetails || [],
	};

	const ROLE_MAPPING: Record<string, string> = {
		CLUB_OWNER: t("Club owner"),
		MANAGER: t("Club manager"),
		USER: t("Member"),
	};

	return (
		<div className="container py-6 space-y-6">
			<h1 className="text-2xl font-bold">{t("Welcome, {name}", { name: user.name })}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Events")}</div>
					<div className="text-2xl font-bold">{stats.eventRegistration}</div>
				</div>
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Clubs")}</div>
					<div className="text-2xl font-bold">{stats.clubMembership}</div>
				</div>
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Written reviews")}</div>
					<div className="text-2xl font-bold">{stats.reviewsWritten}</div>
				</div>
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Reviews received")}</div>
					<div className="text-2xl font-bold">{stats.reviewsReceived}</div>
				</div>
			</div>
			{userWithDetails?.clubMembership && userWithDetails.clubMembership.length > 0 && (
				<div className="space-y-4">
					<h2 className="text-xl font-semibold">{t("My clubs")}</h2>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{userWithDetails.clubMembership.map((membership) => (
							<Link
								key={membership.club?.id}
								href={`/dashboard/${membership.club?.id}/club`}
								className="relative overflow-hidden bg-sidebar hover:bg-accent  rounded-md border transition-all"
							>
								<div className="relative space-y-4 p-6">
									{/* Club Header */}
									<div className="flex items-center justify-between">
										<div className="space-y-1">
											<h3 className="font-semibold text-lg leading-none">
												{membership.club?.name}
											</h3>
											<p className="text-sm text-muted-foreground">
												{ROLE_MAPPING[membership.role]}
											</p>
										</div>
										<ClubAvatar
											name={membership.club?.name ?? ""}
											logo={membership.club?.logo}
											size={48}
										/>
									</div>

									{/* Club Stats */}
									{membership.club?._count && (
										<div className="flex items-center justify-between rounded-lg border bg-background/50 p-4">
											<div className="text-center">
												<p className="text-2xl font-bold">{membership.club._count.members}</p>
												<p className="text-xs text-muted-foreground">
													{t("{count, plural, =1 {member} other {members}}", {
														count: membership.club._count.members,
													})}
												</p>
											</div>
											<div className="text-center">
												<p className="text-2xl font-bold">{membership.club._count.events}</p>
												<p className="text-xs text-muted-foreground">
													{t("{count, plural, =1 {event} other {events}}", {
														count: membership.club._count.events,
													})}
												</p>
											</div>
											<div className="text-center">
												<p className="text-2xl font-bold">{membership.club._count.reviews}</p>
												<p className="text-xs text-muted-foreground">
													{t("{count, plural, =1 {review} other {reviews}}", {
														count: membership.club._count.reviews,
													})}
												</p>
											</div>
										</div>
									)}
								</div>
							</Link>
						))}
					</div>
				</div>
			)}

			{userWithDetails?.eventRegistration && userWithDetails.eventRegistration.length > 0 && (
				<div className="space-y-4">
					<h2 className="text-xl font-semibold">{t("Recent events")}</h2>
					<div className="space-y-2">
						{userWithDetails.eventRegistration.slice(0, 5).map((registration) => (
							<Link
								key={registration.event?.id}
								href={`/events/${registration.event?.slug || registration.event?.id || ""}`}
								className="p-4 border rounded-lg block hover:bg-muted/50 transition-colors"
							>
								<div className="flex justify-between items-center">
									<div>
										<div className="font-medium">{registration.event?.name || ""}</div>
										<div className="text-sm text-muted-foreground">
											{new Date(registration.event?.dateStart || "").toLocaleDateString(
												toIntlLocale("bs"),
											)}
										</div>
									</div>
									<div className="text-sm capitalize">{registration.type.toLowerCase()}</div>
								</div>
							</Link>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
