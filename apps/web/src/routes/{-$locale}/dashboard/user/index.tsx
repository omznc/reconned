import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Eye, Pencil } from "lucide-react";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import { UserOverview } from "@/components/overviews/user-overview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";

const getUserFn = createServerFn({ method: "GET" })
	.validator(z.object({ userId: z.string() }))
	.handler(async ({ data }) => {
		const { data: userFromDb, error } = await apiServer.GET("/api/users/{id}", {
			params: { path: { id: data.userId } },
		});
		return error || !userFromDb ? null : userFromDb;
	});

export const Route = createFileRoute("/{-$locale}/dashboard/user/")({
	loader: ({ context }) => getUserFn({ data: { userId: context.user.id } }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: UserPage,
});

function UserPage() {
	const t = useExtracted();
	const userFromDb = Route.useLoaderData();
	const { user } = Route.useRouteContext();

	if (!userFromDb) {
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
