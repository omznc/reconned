import { SecuritySettings } from "@/app/dashboard/(user)/user/security/_components/security-settings";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

	const passkeys = await prisma.passkey.findMany({
		where: {
			userId: user.id,
		},
	});

	return <SecuritySettings passkeys={passkeys} hasPassword={hasPassword} />;
}
