import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PageProps {
	params: Promise<{ id: string }>;
}

export default async function Page(props: PageProps) {
	const user = await prisma.user.findUnique({
		where: {
			id: (await props.params).id,
			publicProfile: true,
		},
	});
	if (!user) {
		return notFound();
	}

	return (
		<div className="flex flex-col size-full gap-8">
			<div className="flex flex-col gap-3">
				<h1 className="text-3xl font-bold">{user?.name}</h1>
			</div>
		</div>
	);
}
