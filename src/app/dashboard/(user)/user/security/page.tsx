import { SecuritySettings } from "@/app/dashboard/(user)/user/security/_components/security-settings";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function Page() {
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const userFromDb = await prisma.user.findUnique({
		where: {
			id: user.id,
		},
	});

	const usersPasskeys = await prisma.passkey.findMany({
		where: {
			userId: user.id,
		},
	});

	if (!userFromDb) {
		return notFound();
	}

	return <SecuritySettings passkeys={usersPasskeys} />;
}
