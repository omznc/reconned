import { format } from "date-fns";
import { ArrowUpRight, Calendar, Globe, MapPin, Users } from "lucide-react";
import { getExtracted, getLocale } from "next-intl/server";
import { InviteActions } from "@/app/[locale]/dashboard/(user)/user/invites/_components/invite-actions";
import { ErrorPage } from "@/components/error-page";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export default async function InvitesPage() {
	const [user, locale] = await Promise.all([isAuthenticated(), getLocale()]);
	if (!user) {
		return redirect({
			href: "/login",
			locale,
		});
	}

	const t = await getExtracted();

	const { data, error } = await apiServer.GET("/api/users/invites");

	if (error || !data) {
		return <ErrorPage title={t("Error loading invitations")} />;
	}

	const invites = data.invites;

	return (
		<div className="container py-6 space-y-6">
			<h1 className="text-2xl font-bold">{t("Invitations")}</h1>

			{invites.length === 0 ? (
				<p className="text-muted-foreground">{t("You have no invitations")}</p>
			) : (
				<div className="grid gap-4">
					{invites.map((invite) => (
						<Card key={invite.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<h3 className="text-lg font-semibold">{invite.club.name}</h3>
											{!invite.club.isPrivate && (
												<Link
													href={`/clubs/${invite.club.slug || invite.club.id}`}
													target="_blank"
													rel="noopener noreferrer"
													className="text-muted-foreground hover:text-foreground transition-colors"
													title={t("View public page")}
												>
													<ArrowUpRight className="h-4 w-4" />
												</Link>
											)}
										</div>
										<div className="flex flex-wrap gap-2 mt-2">
											{invite.club.verified && (
												<Badge variant="secondary" className="text-xs">
													{t("Verified")}
												</Badge>
											)}
											{invite.club.isAllied && (
												<Badge variant="outline" className="text-xs">
													{t("Allied")}
												</Badge>
											)}
											{invite.club.isPrivate && (
												<Badge variant="destructive" className="text-xs">
													{t("Private")}
												</Badge>
											)}
										</div>
									</div>
									<InviteActions invite={invite} />
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								{invite.club.description && (
									<p className="text-sm text-muted-foreground">{invite.club.description}</p>
								)}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
									{invite.club.location && (
										<div className="flex items-center gap-2">
											<MapPin className="h-4 w-4 text-muted-foreground" />
											<span>{invite.club.location}</span>
										</div>
									)}
									{invite.club.website && (
										<div className="flex items-center gap-2">
											<Globe className="h-4 w-4 text-muted-foreground" />
											<a
												href={invite.club.website}
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-600 hover:underline"
											>
												{t("Website")}
											</a>
										</div>
									)}
									{invite.club.dateFounded && (
										<div className="flex items-center gap-2">
											<Calendar className="h-4 w-4 text-muted-foreground" />
											<span>
												{t("Founded")} {format(new Date(invite.club.dateFounded), "yyyy")}
											</span>
										</div>
									)}
									<div className="flex items-center gap-2">
										<Users className="h-4 w-4 text-muted-foreground" />
										<span>
											{invite.club._count?.members || 0} {t("members")}
										</span>
									</div>
									{invite.club.contactEmail && (
										<div className="flex items-center gap-2">
											<span className="text-muted-foreground">📧</span>
											<a
												href={`mailto:${invite.club.contactEmail}`}
												className="text-blue-600 hover:underline"
											>
												{t("Contact")}
											</a>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
