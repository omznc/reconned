import { Role } from "@generated/client";
import { Square } from "lucide-react";
import Image from "next/image";
import { getExtracted, getLocale } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import { Link, redirect } from "@/i18n/navigation";
import { isAuthenticated } from "@/lib/auth";
import { IMAGE_SIZES } from "@/lib/image-sizes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage() {
	const [user, locale, t] = await Promise.all([isAuthenticated(), getLocale(), getExtracted()]);

	if (!user) {
		return redirect({ href: "/login", locale });
	}

	const stats = await prisma.user.findUnique({
		where: { id: user.id },
		select: {
			_count: {
				select: {
					eventRegistration: true,
					clubMembership: true,
					reviewsWritten: true,
					reviewsReceived: true,
				},
			},
			clubMembership: {
				include: {
					club: {
						include: {
							_count: {
								select: {
									members: true,
									events: true,
									reviews: true,
								},
							},
							events: {
								take: 1,
								where: {
									dateStart: {
										gte: new Date(),
									},
								},
								orderBy: {
									dateStart: "asc",
								},
							},
							reviews: {
								take: 1,
								orderBy: {
									createdAt: "desc",
								},
							},
						},
					},
				},
			},
			eventRegistration: {
				take: 5,
				orderBy: {
					createdAt: "desc",
				},
				include: {
					event: true,
				},
			},
		},
	});

	if (!stats) {
		return <ErrorPage title={t("An error occurred")} />;
	}

	const ROLE_MAPPING: Record<Role, string> = {
		[Role.CLUB_OWNER]: t("Club owner"),
		[Role.MANAGER]: t("Club manager"),
		[Role.USER]: t("Member"),
	};

	return (
		<div className="container py-6 space-y-6">
			<h1 className="text-2xl font-bold">{t("Welcome, {name}", { name: user.name })}</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Events")}</div>
					<div className="text-2xl font-bold">{stats._count.eventRegistration}</div>
				</div>
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Clubs")}</div>
					<div className="text-2xl font-bold">{stats._count.clubMembership}</div>
				</div>
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Written reviews")}</div>
					<div className="text-2xl font-bold">{stats._count.reviewsWritten}</div>
				</div>
				<div className="p-4 border rounded-lg bg-sidebar">
					<div className="text-sm text-muted-foreground">{t("Reviews received")}</div>
					<div className="text-2xl font-bold">{stats._count.reviewsReceived}</div>
				</div>
			</div>

			{stats.clubMembership.length > 0 && (
				<div className="space-y-4">
					<h2 className="text-xl font-semibold">{t("My clubs")}</h2>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{stats.clubMembership.map((membership) => (
							<Link
								key={membership.club.id}
								href={`/dashboard/${membership.club.id}/club`}
								className="relative overflow-hidden bg-sidebar hover:bg-accent  rounded-md border transition-all"
							>
								<div className="relative space-y-4 p-6">
									{/* Club Header */}
									<div className="flex items-center justify-between">
										<div className="space-y-1">
											<h3 className="font-semibold text-lg leading-none">
												{membership.club.name}
											</h3>
											<p className="text-sm text-muted-foreground">
												{ROLE_MAPPING[membership.role]}
											</p>
										</div>
										<div className="h-12 w-12">
											{membership.club.logo ? (
												<Image
													suppressHydrationWarning
													width={IMAGE_SIZES.THUMBNAIL}
													height={IMAGE_SIZES.THUMBNAIL}
													src={membership.club.logo}
													alt={membership.club.name}
													className="h-full w-full object-contain"
												/>
											) : (
												<div className="flex h-full w-full items-center justify-center">
													<Square className="h-6 w-6 text-muted-foreground" />
												</div>
											)}
										</div>
									</div>

									{/* Club Stats */}
									<div className="flex items-center justify-between rounded-lg border bg-background/50 p-4">
										<div className="text-center">
											<p className="text-2xl font-bold">{membership.club._count.members}</p>
											<p className="text-xs text-muted-foreground">
												{membership.club._count.members === 1 ? "član" : "članova"}
											</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold">{membership.club._count.events}</p>
											<p className="text-xs text-muted-foreground">
												{membership.club._count.events === 1 ? "susret" : "susreta"}
											</p>
										</div>
										<div className="text-center">
											<p className="text-2xl font-bold">{membership.club._count.reviews}</p>
											<p className="text-xs text-muted-foreground">
												{membership.club._count.reviews === 1 ? "recenzija" : "recenzija"}
											</p>
										</div>
									</div>

									{/* Additional Info */}
									<div className="space-y-3">
										{membership.club.events[0] && (
											<div className="rounded-lg border bg-background/50 p-3">
												<p className="text-sm font-medium mb-1">{t("Next event")}</p>
												<p className="text-sm text-muted-foreground line-clamp-1">
													{membership.club.events[0].name} •{" "}
													{membership.club.events[0].dateStart.toLocaleDateString("bs")}
												</p>
											</div>
										)}

										{membership.club.reviews[0] && (
											<div className="rounded-lg border bg-background/50 p-3">
												<p className="text-sm font-medium mb-1">{t("Latest review")}</p>
												<p className="text-sm text-muted-foreground line-clamp-2">
													{membership.club.reviews[0].content}
												</p>
											</div>
										)}
									</div>
								</div>
							</Link>
						))}
					</div>
				</div>
			)}

			{stats.eventRegistration.length > 0 && (
				<div className="space-y-4">
					<h2 className="text-xl font-semibold">{t("Recent events")}</h2>
					<div className="space-y-2">
						{stats.eventRegistration.map((registration) => (
							<Link
								key={registration.event.id}
								href={`/events/${registration.event.slug}`}
								className="p-4 border rounded-lg block hover:bg-muted/50 transition-colors"
							>
								<div className="flex justify-between items-center">
									<div>
										<div className="font-medium">{registration.event.name}</div>
										<div className="text-sm text-muted-foreground">
											{registration.event.dateStart.toLocaleDateString("bs")}
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
