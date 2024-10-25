import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { AtSign, MailPlus, Pin, User } from "lucide-react";
import Link from "next/link";

interface PageProps {
	params: Promise<{
		clubId: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const events = await prisma.event.findMany({
		where: {
			club: {
				id: params.clubId,
				members: {
					some: {
						userId: user.id,
						role: {
							in: ["CLUB_OWNER", "MANAGER"],
						},
					},
				},
			},
		},
		include: {
			_count: {
				select: {
					invites: true,
					registrations: true,
				},
			},
			club: {
				select: {
					name: true,
				},
			},
		},
	});

	return (
		<>
			<div className="space-y-4 max-w-3xl">
				{events.map((event) => (
					<Link
						href={`/dashboard/${params.clubId}/events/${event.id}`}
						key={event.id}
						className="flex gap-4"
					>
						{event.coverImage ? (
							<Image
								src={`${event.coverImage}?v=${Date.now()}`} // This will revalidate the browser cache
								alt={event.name}
								width={150}
								height={150}
							/>
						) : (
							<div className="w-24 h-24 rounded-lg bg-background/80" />
						)}
						<div className="flex flex-col gap-1">
							<div className="flex items-center gap-2">
								<h2 className="text-xl font-semibold">{event.name}</h2>
							</div>
							<p>{event.description}</p>
							<div className="flex items-center gap-2">
								<AtSign size={16} />
								<p>{event.club.name}</p>
							</div>
							<div className="flex items-center gap-2">
								<Pin size={16} />
								<p>{event.location}</p>
							</div>
							<div className="flex items-center gap-2">
								<User size={16} />
								<p>{event._count.registrations} prijavljenih</p>
							</div>
							<div className="flex items-center gap-2">
								<MailPlus size={16} />
								<p>{event._count.invites} pozvanih</p>
							</div>
						</div>
					</Link>
				))}
			</div>
		</>
	);
}
