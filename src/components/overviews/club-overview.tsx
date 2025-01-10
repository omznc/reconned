import { Badge } from "@/components/ui/badge";
import type { Club, Post } from "@prisma/client";
import {
	AtSign,
	Eye,
	EyeOff,
	MapPin,
	Pencil,
	Phone,
	User as UserIcon,
} from "lucide-react";
import Image from "next/image";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { ClubPost } from "@/components/overviews/club-post";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ClubOverviewProps {
	club: Club & {
		_count: {
			members: number;
		};
		posts: (Post & { createdAt: Date })[];
	};
	isManager?: boolean;
}

export function ClubOverview({ club, isManager }: ClubOverviewProps) {
	return (
		<div className="space-y-6">
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
					<UserIcon className="w-4 h-4" />
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
			<ReviewsOverview type="club" typeId={club.id} />
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold flex items-center gap-2">
						Objave
					</h2>
					{isManager && (
						<Button asChild>
							<Link href={`/dashboard/${club.id}/club/posts`}>
								<Pencil className="h-4 w-4" />
								Nova objava
							</Link>
						</Button>
					)}
				</div>
				{!club.posts || club.posts.length === 0 ? (
					<p className="text-muted-foreground">Nema objava</p>
				) : (
					<div className="space-y-4">
						{club.posts?.map((post) => (
							<ClubPost
								key={post.id}
								post={post}
								clubId={club.id}
								isManager={isManager}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
