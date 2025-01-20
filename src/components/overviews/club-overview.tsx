import { Badge } from "@/components/ui/badge";
import type { Club, Post } from "@prisma/client";
import {
	AtSign,
	Cog,
	Eye,
	EyeOff,
	MapIcon,
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
import { getPageViews } from "@/lib/analytics";
import { Map } from "lucide-react"; // Add this import

interface ClubOverviewProps {
	club: Club & {
		_count: {
			members: number;
		};
		posts: (Post & { createdAt: Date })[];
	};
	isManager?: boolean;
}

export async function ClubOverview({ club, isManager }: ClubOverviewProps) {
	const [analyticsId, analyticsSlug] = await Promise.all([
		getPageViews(`/clubs/${club.id}`),
		getPageViews(`/clubs/${club.slug}`),
	]);
	const visitors =
		analyticsId.results.visitors.value + analyticsSlug.results.visitors.value;
	const posts = club.posts.sort((a, b) => {
		if (a.createdAt < b.createdAt) {
			return 1;
		}
		if (a.createdAt > b.createdAt) {
			return -1;
		}
		return 0;
	});

	return (
		<div className="space-y-6">
			<div className="flex flex-col-reverse gap-4 md:gap-2 md:flex-row justify-between">
				<div className="flex gap-4">
					{/* TODO: Handle if unset */}
					{club.logo && (
						<Image
							suppressHydrationWarning={true}
							src={club.logo}
							alt={club.name}
							width={150}
							height={150}
							className="h-[150px] w-auto"
							draggable={false}
						/>
					)}
					<div className="flex select-none flex-col gap-1">
						<div className="flex items-center gap-2">
							<h1 className="text-2xl font-semibold">{club.name}</h1>
							<Badge variant="outline" className="h-fit">
								{visitors} pregled/a
							</Badge>
						</div>
						<p className="text-accent-foreground/80">{club.description}</p>
					</div>
				</div>
				<div className="flex gap-2">
					{club.latitude && club.longitude && (
						<Button asChild variant="outline">
							<Link href={`/map?clubId=${club.slug || club.id}`}>
								<MapIcon className="h-4 w-4 mr-2" />
								Mapa
							</Link>
						</Button>
					)}
					{isManager && (
						<Button asChild>
							<Link href={`/dashboard/${club.id}/club/information`}>
								<Cog className="h-4 w-4 mr-2" />
								Uredi klub
							</Link>
						</Button>
					)}
				</div>
			</div>
			<div className="flex flex-wrap gap-0">
				<Badge className="flex items-center gap-1">
					<UserIcon className="w-4 h-4" />
					{club._count?.members}{" "}
					{club._count?.members === 1 ? "član" : "članova"}
				</Badge>
				<Badge className="flex items-center gap-1">
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
					<Badge className="flex items-center gap-1">
						<MapPin className="w-4 h-4" />
						{club.location}
					</Badge>
				)}
				{club.contactEmail && (
					<Badge className="flex items-center gap-1">
						<AtSign className="w-4 h-4" />
						{club.contactEmail}
					</Badge>
				)}
				{club.contactPhone && (
					<Badge className="flex items-center gap-1">
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
				{!posts || posts.length === 0 ? (
					<p className="text-muted-foreground">Nema objava</p>
				) : (
					<div className="space-y-4">
						{posts?.map((post) => (
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
