import { SiInstagram } from "@icons-pack/react-simple-icons";
import {
	Cog,
	Eye,
	EyeOff,
	Handshake,
	MailOpenIcon,
	MapIcon,
	MapPin,
	Pencil,
	Phone,
	Shield,
	ShieldBan,
} from "lucide-react";
import Image from "next/image";
import { Logger } from "next-axiom";
import { getExtracted } from "next-intl/server";
import { ClaimClubForm } from "@/components/claim-club-form";
import { ClubManagerIcon, ClubOwnerIcon, VerifiedClubIcon } from "@/components/icons";
import { LeaveClubButton } from "@/components/leave-club-button";
import { ClubInstagram } from "@/components/overviews/club-instagram";
import { ClubPost } from "@/components/overviews/club-post";
import { ClubWebsiteButton } from "@/components/overviews/club-website-button";
import { ExpandableDescription } from "@/components/overviews/expandable-description";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ApiResponse, ClubMembership } from "@/lib/api/api-type-helpers";
import { cn } from "@/lib/utils";

interface ClubOverviewProps {
	club: ApiResponse<"/api/clubs/{id}", "get">;
	isManager?: boolean;
	isMember?: boolean;
	currentUserMembership?: ClubMembership | null;
	hasOwner?: boolean;
	user?: { id: string; name: string; email: string; callsign?: string | null } | null;
	members?: ApiResponse<"/api/clubs/{id}/members", "get">["members"];
	privateCount?: number;
}

const logger = new Logger({ source: "ClubOverview" });

type InstagramMediaResponse = ApiResponse<"/api/clubs/{id}/instagram/media", "get">;

export async function ClubOverview({
	club,
	isManager,
	isMember,
	currentUserMembership,
	hasOwner = true,
	user,
	members = [],
	privateCount = 0,
}: ClubOverviewProps) {
	const instagramData = club.instagramConnected
		? await apiServer
				.GET("/api/clubs/{id}/instagram/media", {
					params: {
						path: { id: club.id },
						query: { limit: 20 },
					},
				})
				.then((response) => {
					if (response.data) {
						return response.data;
					}

					return {
						media: [],
						username: club.instagramUsername || null,
					} as InstagramMediaResponse;
				})
		: ({
				media: [],
				username: club.instagramUsername || null,
			} as InstagramMediaResponse);

	const t = await getExtracted();
	const [postsResponse, alliancesResponse] = await Promise.all([
		apiServer.GET("/api/clubs/{id}/posts", {
			params: {
				path: { id: club.id },
			},
		}),
		apiServer.GET("/api/clubs/{id}/alliances", {
			params: {
				path: { id: club.id },
			},
		}),
	]);

	const posts = postsResponse.data?.posts || [];
	const alliances = alliancesResponse.data?.alliances || [];

	if (postsResponse.error) {
		logger.error("Error fetching club posts", { error: postsResponse.error });
	}

	const isClubOwner = currentUserMembership?.role === "CLUB_OWNER";

	return (
		<div>
			{/* Unified Banner Section - Always Present */}
			<div className="relative w-full mb-6">
				<div className="w-full h-full max-h-[300px] bg-sidebar rounded-md">
					{club.headerImage ? (
						<Image
							suppressHydrationWarning={true}
							src={club.headerImage}
							alt={`${club.name} header`}
							className="object-contain w-full h-full rounded-md"
							draggable={false}
							height={300}
							width={1200}
						/>
					) : (
						<div className="w-full h-full bg-gradient-to-br from-sidebar to-muted rounded-md" />
					)}
				</div>

				{/* Edit Button - Always Top Right */}
				{isManager && (
					<div className="absolute top-4 right-4">
						<Button asChild size="sm">
							<Link href={`/dashboard/${club.id}/club/information`}>
								<Cog className="h-4 w-4 mr-2" />
								{t("Edit club")}
							</Link>
						</Button>
					</div>
				)}
			</div>

			<div className="flex flex-col gap-6">
				<div className="flex gap-6 items-start">
					<div className="shrink-0 w-32 h-32 flex items-center justify-center">
						{club.logo ? (
							<Image
								suppressHydrationWarning={true}
								src={club.logo}
								alt={club.name}
								width={128}
								height={128}
								className="w-full h-full object-contain"
								draggable={false}
							/>
						) : (
							<div className="w-full h-full border-4 border-background rounded-md bg-sidebar shadow-lg flex items-center justify-center">
								<ShieldBan className="size-16 text-muted-foreground" />
							</div>
						)}
					</div>

					<div className="flex-1 min-w-0 pt-2">
						<h1 className="text-3xl flex gap-2 items-center font-semibold mb-2">
							{club.name} {club.verified && <VerifiedClubIcon />}
						</h1>
						<ExpandableDescription description={club.description || ""} />
					</div>
				</div>

				{/* Action Buttons Row */}
				<div className="flex flex-col md:flex-row gap-2">
					{club.latitude && club.longitude && (
						<Button asChild variant="outline">
							<Link href={`/map?clubId=${club.slug || club.id}`}>
								<MapIcon className="h-4 w-4 mr-2" />
								{t("Map")}
							</Link>
						</Button>
					)}
					{club.website && <ClubWebsiteButton website={club.website} isVerified={club.verified} />}
					{isMember && !isClubOwner && (
						<LeaveClubButton clubId={club.id} isClubOwner={isClubOwner || false} variant="destructive" />
					)}
				</div>

				{/* Badges Row */}
				<div className="flex flex-wrap gap-2 mb-4">
					<Badge className="md:grow-0 grow flex items-center gap-1">
						{club.isPrivate ? (
							<>
								<EyeOff className="w-4 h-4" />
								{t("Private club")}
							</>
						) : (
							<>
								<Eye className="w-4 h-4" />
								{t("Public club")}
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
							{t("Allied with ASK FBIH")}
						</Badge>
					)}
					{club.contactEmail && (
						<Link href={`mailto:${club.contactEmail}`} className="md:grow-0 grow flex items-center gap-1">
							<Badge className="md:grow-0 grow flex items-center gap-1">
								<MailOpenIcon className="w-4 h-4" />
								{club.contactEmail}
							</Badge>
						</Link>
					)}
					{club.contactPhone && (
						<Badge className="md:grow-0 grow flex items-center gap-1">
							<Phone className="w-4 h-4" />
							{club.contactPhone}
						</Badge>
					)}
				</div>
			</div>
			{!hasOwner && (
				<div className="border bg-sidebar p-6 space-y-4 rounded-md">
					<h2 className="text-xl font-semibold">{t("Claim this club")}</h2>
					<ClaimClubForm clubId={club.id} clubName={club.name} user={user} />
				</div>
			)}
			{hasOwner && (
				<>
					<ReviewsOverview type="club" typeId={club.id} />

					<div
						className={cn("grid grid-cols-1 gap-4", {
							"md:grid-cols-3": members.length > 0 && club.instagramUsername,
						})}
					>
						{members.length > 0 && (
							<div className="h-full bg-sidebar border order-1 md:order-2 md:col-span-1 rounded-md">
								<div className="flex flex-col gap-2 p-4">
									<div className="flex gap-2 items-center">
										<h2 className="text-xl font-semibold">{t("Members")}</h2>
									</div>
									<p>{t("All members of this club")}</p>
								</div>
								<hr className="w-full" />
								<div className="grid gap-1 max-h-[400px] overflow-auto p-4">
									{members
										.sort((a, b) => {
											// Sort order: CLUB_OWNER > MANAGER > USER
											const roleOrder = { CLUB_OWNER: 0, MANAGER: 1, USER: 2 };
											return roleOrder[a.role] - roleOrder[b.role];
										})
										.map((member) => (
											<Link
												key={member.id}
												href={`/users/${member.user.slug || member.user.id}`}
												className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors"
											>
												{member.user.image ? (
													<Image
														src={member.user.image}
														alt={member.user.name}
														width={40}
														height={40}
														className="w-10 h-10 object-cover rounded-md"
														draggable={false}
													/>
												) : (
													<div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground font-semibold">
														{member.user.name.charAt(0).toUpperCase()}
													</div>
												)}
												<div className="flex flex-col flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium truncate">{member.user.name}</span>
														{member.role === "CLUB_OWNER" && <ClubOwnerIcon />}
														{member.role === "MANAGER" && <ClubManagerIcon />}
													</div>
													{member.user.callsign && (
														<span className="text-sm text-muted-foreground truncate">
															{member.user.callsign}
														</span>
													)}
												</div>
											</Link>
										))}
									{privateCount > 0 && (
										<div className="text-sm text-muted-foreground p-2">
											{t("+{count} private members", {
												count: privateCount.toString(),
											})}
										</div>
									)}
								</div>
							</div>
						)}

						{alliances.length > 0 && (
							<div className="space-y-4 h-full bg-sidebar border p-4 order-1 md:order-2 md:col-span-1 rounded-md">
								<div className="flex flex-col gap-2">
									<div className="flex gap-2 items-center">
										<Shield className="h-5 w-5" />
										<h2 className="text-xl font-semibold">{t("Alliances")}</h2>
									</div>
									<p>{t("Club alliances and partnerships")}</p>
								</div>
								<hr />
								<div className="grid gap-2 max-h-[400px] overflow-auto">
									{alliances.map((alliance) => (
										<div key={alliance.id} className="flex items-center gap-2 p-2 rounded border">
											<div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
												<Shield className="h-4 w-4" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-medium truncate">{alliance.name}</p>
												{alliance.description && (
													<p className="text-xs text-muted-foreground truncate">
														{alliance.description}
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{club.instagramUsername && (
							<div
								className={cn("h-full", {
									"md:col-span-2": members.length > 0,
									"md:col-span-3": members.length === 0,
								})}
							>
								<div className="border bg-sidebar h-full rounded-md">
									<div className="flex items-start justify-between border-b p-4">
										<div className="flex flex-col gap-2">
											<div className="flex gap-2 items-center">
												<SiInstagram className="h-5 w-5 text-primary" />
												<h2 className="text-xl font-semibold">{t("Instagram photos")}</h2>
											</div>
											<p>{t("View our latest posts on Instagram")}</p>
										</div>
									</div>
									<div className="p-4">
										<ClubInstagram data={instagramData} />
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="space-y-4 mt-8 ">
						<div className="flex h-10 items-center justify-between">
							<h2 className="text-xl font-semibold flex items-center gap-2">{t("Announcements")}</h2>
							{isManager && (
								<Button asChild size="sm">
									<Link href={`/dashboard/${club.id}/club/posts`}>
										<Pencil className="h-4 w-4" />
										{t("New post")}
									</Link>
								</Button>
							)}
						</div>
						{!posts || posts.length === 0 ? (
							<p className="text-muted-foreground">{t("There are no posts")}</p>
						) : (
							<div className="space-y-4">
								{posts?.map((post) => (
									<ClubPost key={post.id} post={post} clubId={club.id} isManager={isManager} />
								))}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}
