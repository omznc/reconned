import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { UserOverview } from "@/components/user-overview";

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
	return (
		<div className="space-y-4 max-w-3xl">
			<div>
				<h3 className="text-lg font-semibold">Vaš račun</h3>
			</div>
			<UserOverview user={userFromDb} />
		</div>
	);
}
