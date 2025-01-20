import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { UserOverview } from "@/components/overviews/user-overview";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Page() {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const t = await getTranslations('dashboard.user.overview');

	const userFromDb = await prisma.user.findUnique({
		where: {
			id: user.id,
		},
		include: {
			clubMembership: {
				include: {
					club: true,
				},
			},
			eventRegistration: {
				include: {
					event: true,
				},
			},
		},
	});

	if (!userFromDb) {
		return notFound();
	}
	return (
		<>
			<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
				<div className="flex flex-col">
					<AlertTitle>{t('alertTitle')}</AlertTitle>
					<AlertDescription>{t('alertDescription')}</AlertDescription>
				</div>
				<div className="flex gap-1">
					<Button variant="outline" asChild={true}>
						<Link
							className="flex items-center gap-1"
							href={"/dashboard/user/settings"}
						>
							<Pencil size={16} />
							{t('edit')}
						</Link>
					</Button>
					{!userFromDb.isPrivate && (
						<Button variant="outline" asChild={true}>
							<Link
								target="_blank"
								className="flex items-center gap-1"
								href={`/users/${user.id}`}
							>
								<Eye size={16} />
								{t('view')}
							</Link>
						</Button>
					)}
				</div>
			</Alert>
			<UserOverview user={userFromDb} />
		</>
	);
}
