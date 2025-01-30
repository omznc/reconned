import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function InvitesPage() {
    const user = await isAuthenticated();
    if (!user) {
        redirect("/login");
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
                                <h3 className="text-lg font-semibold">
                                    {invite.club.name}
                                </h3>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <p>{invite.club.description}</p>
                                <div className="flex gap-2">
                                    <Link target="_blank" href={`/club/${invite.club.slug ?? invite.club.id}`}
                                        className="inline-flex">
                                        <Button variant="outline">
                                            {t("viewClub")}
                                        </Button>
                                    </Link>
                                    <Link href={`/api/club/member-invite/${invite.inviteCode}`}
                                        className="inline-flex">
                                        <Button variant="default">
                                            {t("approve")}
                                        </Button>
                                    </Link>
                                    <Link href={`/api/club/member-invite/${invite.inviteCode}?action=dismiss`}
                                        className="inline-flex">
                                        <Button variant="outline">
                                            {t("dismiss")}
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
