import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { UserOverview } from "@/components/overviews/user-overview";

interface PageProps {
	params: Promise<{
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;

	const user = await prisma.user.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
		include: {
			clubMembership: {
				include: {
					club: true,
				},
			},
			eventRegistration: {
				include: {
					event: {
						include: {
							club: {
								select: {
									id: true,
									isPrivate: true,
								},
							},
						},
					},
				},
			},
		},
	});

	if (!user) {
		return notFound();
	}

	// Filter out private events and private clubs
	user.eventRegistration = user.eventRegistration.filter(
		(reg) => !(reg.event.isPrivate || reg.event.club.isPrivate),
	);
	user.clubMembership = user.clubMembership.filter(
		(membership) => !membership.club.isPrivate,
	);

	return (
		<div className="flex flex-col size-full gap-8">
			<UserOverview user={user} />
		</div>
	);
}
