import { Badge } from "@/components/ui/badge";
import type { Club, ClubMembership, Post, User } from "@prisma/client";
import {
	ArrowUpRight,
	AtSign,
	Cog,
	Eye,
	EyeOff,
	Globe,
	Handshake,
	MapIcon,
	MapPin,
	Pencil,
	Phone,
	ShieldBan,
} from "lucide-react";
import Image from "next/image";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { ClubPost } from "@/components/overviews/club-post";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getPageViews } from "@/lib/analytics";
import { getTranslations } from "next-intl/server";
import { AdminIcon, ClubManagerIcon, ClubOwnerIcon, VerifiedClubIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { LeaveClubButton } from "@/components/leave-club-button";
import { checkAndRefreshToken, getInstagramMedia, type InstagramMedia } from "@/lib/instagram";
import { SiInstagram } from "@icons-pack/react-simple-icons";
import { ClubInstagram } from "@/components/overviews/club-instagram";

interface ClubOverviewProps {
	club: Club & {
		_count: {
			members: number;
		};
		posts: (Post & { createdAt: Date })[];
		members?: (ClubMembership & {
			user: Pick<User, "role" | "id" | "image" | "name" | "callsign" | "slug">;
		})[];
	};
	isManager?: boolean;
	isMember?: boolean;
	currentUserMembership?: ClubMembership | null;
}

async function fetchInstagramPhotos(clubId: string): Promise<{ photos: InstagramMedia[]; username: string | null }> {
	try {
		// Check token validity and refresh if needed
		const { token, igBusinessId } = await checkAndRefreshToken(clubId);

		if (!(token && igBusinessId)) {
			return { photos: [], username: null };
		}

		// Fetch Instagram photos
		const instagramMedia = await getInstagramMedia(igBusinessId, token, 20);
		return {
			photos: instagramMedia.data || [],
			username: instagramMedia.data[0]?.username || null,
		};
	} catch (error) {
		return { photos: [], username: null };
	}
}

export async function ClubOverview({ club, isManager, isMember, currentUserMembership }: ClubOverviewProps) {
	const [analyticsId, analyticsSlug, t, instagramData] = await Promise.all([
		getPageViews(`/clubs/${club.id}`),
		getPageViews(`/clubs/${club.slug}`),
		getTranslations("components.clubOverview"),
		club.instagramConnected
			? fetchInstagramPhotos(club.id)
			: Promise.resolve({
					photos: [],
					username: club.instagramUsername || null,
				}),
	]);
	const visitors = analyticsId.results.visitors.value + analyticsSlug.results.visitors.value;
	const posts = club.posts.sort((a, b) => {
		if (a.createdAt < b.createdAt) {
			return 1;
		}
		if (a.createdAt > b.createdAt) {
			return -1;
		}
		return 0;
	});

	const isClubOwner = currentUserMembership?.role === "CLUB_OWNER";

	// Determine whether to show stats based on privacy setting and user permissions
	const shouldShowStats = !club.isPrivateStats || isManager || isMember;

	return (
		<div className="space-y-6">
			<div className="flex flex-col-reverse gap-4 md:gap-2 md:flex-row justify-between">
				<div className="flex flex-col md:flex-row gap-4">
					{club.logo ? (
						<Image
							suppressHydrationWarning={true}
							src={club.logo}
							alt={club.name}
							width={150}
							height={150}
							className="h-[150px] md:h-[150px] w-auto mx-auto md:mx-0"
							draggable={false}
						/>
					) : (
						<div className="h-[150px] md:h-[150px] aspect-square bg-sidebar flex items-center justify-center border mx-auto md:mx-0">
							<ShieldBan className="size-[50px] text-foreground" />
						</div>
					)}
					<div className="flex select-none flex-col gap-1 text-center md:text-left">
						<div className="flex items-center justify-center md:justify-start gap-2">
							<h1 className="text-2xl flex gap-2 items-center font-semibold">
								{club.name} {club.verified && <VerifiedClubIcon />}
							</h1>
						</div>
						<p className="text-accent-foreground/80">{club.description}</p>
					</div>
				</div>
				<div className="flex flex-col md:flex-row gap-2">
					{club.latitude && club.longitude && (
						<Button asChild variant="outline">
							<Link href={`/map?clubId=${club.slug || club.id}`}>
								<MapIcon className="h-4 w-4 mr-2" />
								{t("map")}
							</Link>
						</Button>
					)}
					{isManager && (
						<Button asChild>
							<Link href={`/dashboard/${club.id}/club/information`}>
								<Cog className="h-4 w-4 mr-2" />
								{t("edit")}
							</Link>
						</Button>
					)}
					{isMember && !isClubOwner && (
						<LeaveClubButton clubId={club.id} isClubOwner={isClubOwner ?? false} variant="destructive" />
					)}
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				<Badge className="md:grow-0 grow flex items-center gap-1">
					{club.isPrivate ? (
						<>
							<EyeOff className="w-4 h-4" />
							{t("private")}
						</>
					) : (
						<>
							<Eye className="w-4 h-4" />
							{t("public")}
						</>
					)}
				</Badge>
				{club.location && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						<MapPin className="w-4 h-4" />
						{club.location}
					</Badge>
				)}
				{club.isAllied && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						<Handshake className="w-4 h-4" />
						{t("allied")}
					</Badge>
				)}
				{club.contactEmail && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						<AtSign className="w-4 h-4" />
						{club.contactEmail}
					</Badge>
				)}
				{club.contactPhone && (
					<Badge className="md:grow-0 grow flex items-center gap-1">
						<Phone className="w-4 h-4" />
						{club.contactPhone}
					</Badge>
				)}
				{club.website && (
					<Link href={club.website} target="_blank" rel="noopener noreferrer" className="md:grow-0 grow">
						<Badge className="flex items-center gap-1 hover:cursor-pointer">
							<Globe className="w-4 h-4" />
							{club.website}
						</Badge>
					</Link>
				)}
				{shouldShowStats && (
					<Badge className="md:grow-0 grow flex items-center gap-1">{t("views", { count: visitors })}</Badge>
				)}
			</div>
			<ReviewsOverview type="club" typeId={club.id} />
			<div
				className={cn("grid grid-cols-1 gap-4 [&>*:last-child]:order-first md:[&>*:last-child]:order-none", {
					"md:grid-cols-3": (club.members?.length ?? 0) > 0,
				})}
			>
				<div className="space-y-4 md:col-span-2">
					<div className="flex h-10 items-center justify-between">
						<h2 className="text-xl font-semibold flex items-center gap-2">{t("posts")}</h2>
						{isManager && (
							<Button asChild size="sm">
								<Link href={`/dashboard/${club.id}/club/posts`}>
									<Pencil className="h-4 w-4" />
									{t("createPost")}
								</Link>
							</Button>
						)}
					</div>
					{!posts || posts.length === 0 ? (
						<p className="text-muted-foreground">{t("noPosts")}</p>
					) : (
						<div className="space-y-4">
							{posts?.map((post) => (
								<ClubPost key={post.id} post={post} clubId={club.id} isManager={isManager} />
							))}
						</div>
					)}
				</div>
				{(club.members?.length ?? 0) > 0 && (
					<div className="space-y-4">
						<h2 className="text-xl h-10 font-semibold items-center flex">{t("members")}</h2>
						<div className="grid gap-2 bg-sidebar border p-4 max-h-[400px] overflow-auto">
							{club.members
								?.sort((a, b) => {
									if (a.role === "CLUB_OWNER") {
										return -1;
									}
									if (b.role === "CLUB_OWNER") {
										return 1;
									}
									if (a.role === "MANAGER") {
										return -1;
									}
									if (b.role === "MANAGER") {
										return 1;
									}
									return 0;
								})
								?.map((membership) => (
									<Link
										className="relative flex group border p-0.5 border-transparent hover:border-red-500 transiton-all items-center gap-2 h-10"
										key={membership.user.id}
										href={`/users/${membership.user.slug ?? membership.user.id}`}
									>
										<ArrowUpRight className="h-4 w-4 hidden group-hover:block text-red-500 right-2 top-2 absolute" />
										{membership.user.image ? (
											<Image
												src={membership.user.image}
												alt={membership.user.name}
												width={32}
												height={32}
												className="size-8"
											/>
										) : (
											<div className="size-8 bg-muted flex items-center justify-center">
												<span className="text-xs text-muted-foreground">
													{membership.user.name.charAt(0)}
												</span>
											</div>
										)}
										<div className="flex flex-col gap-0">
											<h3 className="flex items-center gap-2 font-semibold">
												{membership.user.name}{" "}
												{membership.user.role === "admin" && <AdminIcon />}{" "}
												{membership.role === "CLUB_OWNER" && <ClubOwnerIcon />}
												{membership.role === "MANAGER" && <ClubManagerIcon />}
											</h3>
											<p className="text-muted-foreground -mt-2">{membership.user.callsign}</p>
										</div>
									</Link>
								))}
						</div>
					</div>
				)}
			</div>
			{club.instagramUsername && (
				<div className="rounded-lg border bg-sidebar">
					<div className="flex items-start justify-between border-b p-4">
						<div className="flex flex-col gap-2">
							<div className="flex gap-2 items-center">
								<SiInstagram className="h-5 w-5 text-primary" />
								<h2 className="text-xl font-semibold">{t("instagramGallery")}</h2>
							</div>
							<p>{t("instagramGalleryDescription")}</p>
						</div>
						<Link
							target="_blank"
							href={`https://instagram.com/${club.instagramUsername}`}
							className="flex gap-2 h-full"
						>
							{club.instagramProfilePictureUrl && (
								<Image
									className="aspect-square border"
									src={club.instagramProfilePictureUrl}
									alt={"Instagram profile photo"}
									width={60}
									height={60}
								/>
							)}
						</Link>
					</div>
					<div className="p-4">
						<ClubInstagram
							photos={instagramData.photos}
							username={instagramData.username || club.instagramUsername || undefined}
						/>
					</div>
				</div>
			)}
		</div>
	);
}
