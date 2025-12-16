import { notFound } from "next/navigation";
import { UserInfoForm } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.form";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";

export default async function Page() {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const { data: userFromDb, error } = await apiServer.GET("/api/users/{id}", {
		params: {
			path: {
				id: user.id,
			},
		},
	});

	if (error || !userFromDb) {
		return notFound();
	}

	return <UserInfoForm user={userFromDb} />;
}
