import { getExtracted, getLocale } from "next-intl/server";
import { InviteActions } from "@/app/[locale]/dashboard/(user)/user/invites/_components/invite-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { redirect } from "@/i18n/navigation";
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
		return <div>{t("Error loading invitations")}</div>;
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
								<h3 className="text-lg font-semibold">{invite.club.name}</h3>
							</CardHeader>
							<CardContent className="flex items-center justify-between">
								<p>{invite.club.description}</p>
								<InviteActions invite={invite} />
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
