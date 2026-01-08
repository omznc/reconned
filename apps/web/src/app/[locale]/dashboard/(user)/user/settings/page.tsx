import { getExtracted } from "next-intl/server";
import { UserInfoForm } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.form";
import { ErrorPage } from "@/components/error-page";
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

	return <UserInfoForm user={userFromDb} />;
}
