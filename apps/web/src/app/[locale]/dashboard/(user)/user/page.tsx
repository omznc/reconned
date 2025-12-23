import { Eye, Pencil } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ErrorPage } from "@/components/error-page";
import { UserOverview } from "@/components/overviews/user-overview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export default async function Page() {
	const t = await getExtracted();
	const user = await isAuthenticated();
	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const { data: userFromDb, error } = await apiServer.GET("/api/users/{id}", {
		params: {
			path: {
				id: user.id,
			},
		},
	});

	if (error || !userFromDb) {
		return <ErrorPage title={t("An error occurred")} link="/dashboard" />;
	}
	return (
		<>
			<Alert className="flex flex-col md:flex-row gap-1 justify-between -z-0">
				<div className="flex flex-col">
					<AlertTitle>{t("Your account")}</AlertTitle>
					<AlertDescription>{t("You can see your profile here")}</AlertDescription>
				</div>
				<div className="flex gap-1 flex-col md:flex-row">
					<Button variant="outline" asChild={true}>
						<Link className="flex items-center gap-1" href={"/dashboard/user/settings"}>
							<Pencil size={16} />
							{t("Edit profile")}
						</Link>
					</Button>
					{!userFromDb.isPrivate && (
						<Button variant="outline" asChild={true}>
							<Link target="_blank" className="flex items-center gap-1" href={`/users/${user.id}`}>
								<Eye size={16} />
								{t("View profile")}
							</Link>
						</Button>
					)}
				</div>
			</Alert>
			<UserOverview user={userFromDb} />
		</>
	);
}
