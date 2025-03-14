import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { InviteActions } from "@/app/[locale]/dashboard/(user)/user/invites/_components/invite-actions";

export default async function InvitesPage() {
	const [user, locale] = await Promise.all([isAuthenticated(), getLocale()]);
	if (!user) {
		return redirect({
			href: "/login",
			locale,
		});
	}

	const t = await getTranslations("dashboard.user.invites");

	const invites = await prisma.clubInvite.findMany({
		where: {
			email: user.email,
			status: "PENDING",
		},
		include: {
			club: true,
		},
	});

	return (
		<div className="container py-6 space-y-6">
			<h1 className="text-2xl font-bold">{t("title")}</h1>

			{invites.length === 0 ? (
				<p className="text-muted-foreground">{t("noInvites")}</p>
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
