import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { useExtracted } from "next-intl";
import type { ComponentProps } from "react";
import { ErrorPage } from "@/components/error-page";
import { LoadingPage } from "@/components/loading-page";
import { NotFoundPage } from "@/components/not-found-page";
import apiServer from "@/lib/api/api";
import { isAuthenticated } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { SecuritySettings } from "@/routes/{-$locale}/dashboard/user/security/-components/security-settings";

type SecurityPage =
	| { kind: "sessions-error" }
	| { kind: "passkeys-error" }
	| { kind: "ok"; props: ComponentProps<typeof SecuritySettings> };

async function fetchHasPassword(userId: string): Promise<boolean> {
	const { data, error } = await apiServer.GET("/api/users/{id}/account", {
		params: { path: { id: userId } },
	});
	return data && !error ? data.hasPassword || false : false;
}

const getSecurityPageFn = createServerFn({ method: "GET" }).handler(async (): Promise<SecurityPage | null> => {
	const user = await isAuthenticated();
	if (!user) {
		return null;
	}

	const hasPassword = await fetchHasPassword(user.id);

	const fetchOptions = { headers: getRequestHeaders() };
	const sessions = await authClient.listSessions({ fetchOptions });
	if (sessions.error) {
		return { kind: "sessions-error" };
	}
	const passkeys = await authClient.passkey.listUserPasskeys({ fetchOptions });
	if (passkeys.error) {
		return { kind: "passkeys-error" };
	}

	const sessionsList =
		sessions.data && sessions.data.length > 0
			? sessions.data.map((session) => ({
					...session,
					isCurrentSession: session.id === user.session.id,
					ipAddress: session.ipAddress || undefined,
					userAgent: session.userAgent || undefined,
				}))
			: [
					{
						id: user.session.id,
						token: user.session.token,
						userId: user.id,
						isCurrentSession: true,
						ipAddress: user.session.ipAddress || undefined,
						userAgent: user.session.userAgent || undefined,
						createdAt: user.session.createdAt,
						updatedAt: user.session.updatedAt,
						expiresAt: user.session.expiresAt,
					},
				];

	return {
		kind: "ok",
		props: {
			passkeys: passkeys.data || [],
			hasPassword,
			hasTwoFactor: user.twoFactorEnabled,
			sessions: sessionsList,
			currentSession: user.session,
			userId: user.id,
		},
	};
});

export const Route = createFileRoute("/{-$locale}/dashboard/user/security/")({
	loader: () => getSecurityPageFn(),
	pendingComponent: LoadingPage,
	notFoundComponent: NotFoundPage,
	component: SecurityPage,
});

function SecurityPage() {
	const t = useExtracted();
	const page = Route.useLoaderData();

	if (!page) {
		return <ErrorPage title={t("You have no access to this page")} />;
	}
	if (page.kind === "sessions-error") {
		return <ErrorPage title={t("Error loading sessions")} />;
	}
	if (page.kind === "passkeys-error") {
		return <ErrorPage title={t("Error loading passkeys")} />;
	}

	return <SecuritySettings {...page.props} />;
}
