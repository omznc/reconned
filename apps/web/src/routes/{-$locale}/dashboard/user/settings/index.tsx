import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useExtracted } from "next-intl";
import * as z from "zod";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { UserInfoForm } from "@/routes/{-$locale}/dashboard/user/settings/-components/user-info.form";

const getSettingsUserFn = createServerFn({ method: "GET" })
	.validator(z.object({ userId: z.string() }))
	.handler(async ({ data }) => {
		const { data: userFromDb, error } = await apiServer.GET("/api/users/{id}", {
			params: { path: { id: data.userId } },
		});
		return error || !userFromDb ? null : userFromDb;
	});

export const Route = createFileRoute("/{-$locale}/dashboard/user/settings/")({
	loader: ({ context }) => getSettingsUserFn({ data: { userId: context.user.id } }),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: UserSettingsPage,
});

function UserSettingsPage() {
	const t = useExtracted();
	const userFromDb = Route.useLoaderData();

	if (!userFromDb) {
		return <ErrorPage title={t("An error occurred")} link="/dashboard" />;
	}

	return <UserInfoForm user={userFromDb} />;
}
