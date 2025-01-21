import { SecuritySettings } from "@/app/dashboard/(user)/user/security/_components/security-settings";
import { auth, isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

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

	const passkeys = await auth.api.listPasskeys({
		headers: await headers(),
	});

	const backupCodes = await auth.api
		.viewBackupCodes({
			body: {
				userId: user.id,
			},
			headers: await headers(),
		})
		.catch((e) => {
			console.log(e);
			return {
				backupCodes: [],
			};
		});

	const sessions = await auth.api.listSessions({
		headers: await headers(),
	});

	return (
		<SecuritySettings
			passkeys={passkeys}
			hasPassword={hasPassword}
			hasTwoFactor={user.twoFactorEnabled}
			backupCodes={backupCodes.backupCodes}
			sessions={sessions.map((session) => ({
				...session,
				isCurrentSession: session.id === user.session.id,
				ipAddress: session.ipAddress ?? null,
				userAgent: session.userAgent ?? null,
			}))}
		/>
	);
}
