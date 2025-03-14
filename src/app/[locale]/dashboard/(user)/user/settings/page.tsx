import { UserInfoForm } from "@/app/[locale]/dashboard/(user)/user/settings/_components/user-info.form";
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

	if (!userFromDb) {
		return notFound();
	}

	return <UserInfoForm user={userFromDb} />;
}
