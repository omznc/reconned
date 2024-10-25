import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { AtSign, Eye, EyeOff, Phone, Pin, User } from "lucide-react";

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

	const club = await prisma.club.findUnique({
		where: {
			members: {
				some: {
					userId: user.id,
					role: {
						in: ["CLUB_OWNER", "MANAGER"],
					},
				},
			},
			id: params.clubId,
		},
		include: {
			_count: {
				select: {
					members: true,
				},
			},
		},
	});

	if (!club) {
		return notFound();
	}
	return (
		<div className="space-y-4 max-w-3xl">
			<div>
				<h3 className="text-lg font-semibold">Klub</h3>
			</div>
			<div className="flex gap-4">
				<Image
					src={`${club.logo}?v=${Date.now()}`} // This will revalidate the browser cache
					alt={club.name}
					width={150}
					height={150}
					className="h-[150px] w-auto"
					draggable={false}
				/>
				<div className="flex select-none flex-col gap-1">
					<h1 className="text-2xl font-semibold">{club.name}</h1>
					<p className="text-accent-foreground/80">{club.description}</p>
				</div>
			</div>
			<div className="flex flex-wrap gap-1">
				<Badge variant="outline" className="flex items-center gap-1">
					<User className="w-4 h-4" />
					{club._count?.members}
				</Badge>
				<Badge variant="outline" className="flex items-center gap-1">
					{club.isPrivate ? (
						<>
							<EyeOff className="w-4 h-4" />
							Privatni klub
						</>
					) : (
						<>
							<Eye className="w-4 h-4" />
							Javni klub
						</>
					)}
				</Badge>
				{club.location && (
					<Badge variant="outline" className="flex items-center gap-1">
						<Pin className="w-4 h-4" />
						{club.location}
					</Badge>
				)}
				{club.contactEmail && (
					<Badge variant="outline" className="flex items-center gap-1">
						<AtSign className="w-4 h-4" />
						{club.contactEmail}
					</Badge>
				)}
				{club.contactPhone && (
					<Badge variant="outline" className="flex items-center gap-1">
						<Phone className="w-4 h-4" />
						{club.contactPhone}
					</Badge>
				)}
			</div>
		</div>
	);
}
