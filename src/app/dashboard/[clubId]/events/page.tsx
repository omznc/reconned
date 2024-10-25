import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MailPlus, Pin, User } from "lucide-react";
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
		<div className="space-y-4 max-w-3xl w-full">
			<div>
				<h3 className="text-lg font-semibold">Svi susreti</h3>
			</div>
			{events.map((event) => (
				<Link
					href={`/dashboard/${params.clubId}/events/${event.id}`}
					key={event.id}
					className="flex hover:bg-accent bg-background transition-all border p-2 gap-4"
				>
					<div className="h-[150px] w-[150px]">
						{event.coverImage ? (
							<Image
								src={`${event.coverImage}?v=${Date.now()}`}
								alt={event.name}
								width={100}
								height={100}
								className="object-cover size-full"
								draggable={false}
							/>
						) : (
							<div className="bg-gray-200 rounded-lg w-24 h-24" />
						)}
					</div>
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-2">
							<h2 className="text-xl font-semibold">{event.name}</h2>
						</div>
						<p className="overflow-hidden truncate max-w-[500px]">
							{event.description}
						</p>
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
	);
}
