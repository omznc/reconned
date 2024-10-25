import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, Pencil, Pin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PageProps {
	params: Promise<{
		clubId: string;
		id: string;
	}>;
}

export default async function Page(props: PageProps) {
	const params = await props.params;
	const user = await isAuthenticated();
	if (!user) {
		return notFound();
	}

	const event = await prisma.event.findFirst({
		where: {
			id: params.id,
			club: {
				members: {
					some: {
						userId: user.id,
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
		},
	});

	console.log(event);

	if (!event) {
		return notFound();
	}

	return (
		<>
			<div className="space-y-4 max-w-3xl">
				<div>
					<h3 className="text-lg font-semibold">Susret</h3>
				</div>
				<div className="flex gap-4">
					<Image
						src={`${event.coverImage}?v=${Date.now()}`} // This will revalidate the browser cache
						alt={event.name}
						width={150}
						height={150}
						className="h-[150px] w-auto"
						draggable={false}
					/>
					<div className="flex select-none flex-col gap-1">
						<h1 className="text-2xl font-semibold">{event.name}</h1>
						<p className="text-accent-foreground/80">{event.description}</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-1">
					<Badge variant="outline" className="flex items-center gap-1">
						<User className="size-4" />
						{event._count?.invites + event._count?.registrations}
					</Badge>
					<Badge variant="outline" className="flex items-center gap-1">
						{event.isPrivate ? (
							<>
								<EyeOff className="size-4" />
								Privatni susret
							</>
						) : (
							<>
								<Eye className="size-4" />
								Javni susret
							</>
						)}
					</Badge>
					{event.location && (
						<Badge variant="outline" className="flex items-center gap-1">
							<Pin className="size-4" />
							{event.location}
						</Badge>
					)}
				</div>
				<Button asChild={true}>
					<Link
						className="flex items-center gap-1"
						href={`/dashboard/${params.clubId}/events/create?id=${event.id}`}
					>
						<Pencil className="size-4" />
						Izmjeni događaj
					</Link>
				</Button>
			</div>
		</>
	);
}
