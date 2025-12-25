import { headers } from "next/headers";
import { getExtracted } from "next-intl/server";
import { SecuritySettings } from "@/app/[locale]/dashboard/(user)/user/security/_components/security-settings";
import { ErrorPage } from "@/components/error-page";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";

export default async function Page() {
	const t = await getExtracted();
	const user = await isAuthenticated();
	if (!user) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}

	const { data: accountData, error } = await apiServer.GET("/api/users/{id}/account", {
		params: {
			path: {
				id: user.id,
			},
		},
	});

	const hasPassword = accountData && !error ? accountData.hasPassword || false : false;

	const sessions = await authClient.listSessions({
		fetchOptions: {
			headers: await headers(),
		},
	});

	if (sessions.error) {
		return <div>Error loading sessions</div>;
	}

	return (
		<SecuritySettings
			passkeys={[]}
			hasPassword={hasPassword}
			hasTwoFactor={user.twoFactorEnabled}
			sessions={sessions.data?.map((session) => ({
				...session,
				isCurrentSession: session.id === user.session.id,
				ipAddress: session.ipAddress || undefined,
				userAgent: session.userAgent || undefined,
				createdAt: session.createdAt.toISOString(),
				updatedAt: session.updatedAt.toISOString(),
				expiresAt: session.expiresAt.toISOString(),
			}))}
			userId={user.id}
		/>
	);
}
