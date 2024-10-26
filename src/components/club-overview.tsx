"use client";

import { Badge } from "@/components/ui/badge";
import type { Club } from "@prisma/client";
import { AtSign, Eye, EyeOff, MapPin, Phone, User } from "lucide-react";
import Image from "next/image";

interface ClubOverviewProps {
	club: Club & {
		_count: {
			members: number;
		};
	};
}

export function ClubOverview({ club }: ClubOverviewProps) {
	return (
		<>
			<div className="flex gap-4">
				{/* TODO: Handle if unset */}
				{club.logo && (
					<Image
						suppressHydrationWarning={true}
						src={`${club.logo}?v=${club.updatedAt}`} // This will revalidate the browser cache
						alt={club.name}
						width={150}
						height={150}
						className="h-[150px] w-auto"
						draggable={false}
					/>
				)}
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
						<MapPin className="w-4 h-4" />
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
		</>
	);
}
