import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SecuritySettings } from "@/app/[locale]/dashboard/(user)/user/security/_components/security-settings";
import { isAuthenticated } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { prisma } from "@/lib/prisma";

export default async function Page() {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const hasPassword =
		(await prisma.account.findFirst({
			where: {
				userId: user.id,
				password: {
					not: null,
				},
			},
			select: {
				password: true,
			},
		})) !== null;

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
				ipAddress: session.ipAddress ?? null,
				userAgent: session.userAgent ?? null,
			}))}
		/>
	);
}
