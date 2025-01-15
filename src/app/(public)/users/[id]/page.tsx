import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { UserOverview } from "@/components/overviews/user-overview";
import type { Metadata } from "next";
import { env } from "@/lib/env";

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
		<div className="flex flex-col size-full gap-8 max-w-[1200px] py-8 px-4">
			<UserOverview user={user} />
		</div>
	);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const params = await props.params;

	const user = await prisma.user.findFirst({
		where: {
			id: params.id,
			isPrivate: false,
		},
	});

	if (!user) {
		return notFound();
	}

	const ogUrl = new URL(`${env.NEXT_PUBLIC_BETTER_AUTH_URL}/api/og/user`);
	ogUrl.searchParams.set("name", user.name);
	if (user.bio) {
		ogUrl.searchParams.set("bio", user.bio);
	}
	if (user.callsign) {
		ogUrl.searchParams.set("callsign", user.callsign);
	}
	if (user.image) {
		ogUrl.searchParams.set("avatar", user.image);
	}

	return {
		title: `${user.name} - RECONNED`,
		description: user.bio?.slice(0, 160) ?? "Airsoft igrač",
		openGraph: {
			images: [
				{
					url: ogUrl.toString(),
					width: 1200,
					height: 630,
					alt: user.name,
				},
			],
		},
		metadataBase: env.NEXT_PUBLIC_BETTER_AUTH_URL
			? new URL(env.NEXT_PUBLIC_BETTER_AUTH_URL)
			: undefined,
	};
}

export async function generateStaticParams() {
	const users = await prisma.user.findMany({
		select: {
			id: true,
		},
		where: {
			isPrivate: false,
		},
	});

	return users.map((user) => ({
		id: user.id,
	}));
}

