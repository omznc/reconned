import { SiInstagram } from "@icons-pack/react-simple-icons";
import {
	ArrowUpRight,
	Cog,
	Eye,
	EyeOff,
	Handshake,
	HandshakeIcon,
	MailOpenIcon,
	MapIcon,
	MapPin,
	Pencil,
	Phone,
	ShieldBan,
} from "lucide-react";
import Image from "next/image";
import { Logger } from "next-axiom";
import { getExtracted } from "next-intl/server";
import { ClaimClubForm } from "@/components/claim-club-form";
import { ClubInviteAcceptance } from "@/components/club-invite-acceptance";
import { ClubManagerIcon, ClubOwnerIcon, VerifiedClubIcon } from "@/components/icons";
import { LeaveClubButton } from "@/components/leave-club-button";
import { ClubInstagram } from "@/components/overviews/club-instagram";
import { ClubPost } from "@/components/overviews/club-post";
import { ClubWebsiteButton } from "@/components/overviews/club-website-button";
import { ExpandableDescription } from "@/components/overviews/expandable-description";
import { ReviewsOverview } from "@/components/overviews/reviews/reviews-overview";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Link } from "@/i18n/navigation";
import apiServer from "@/lib/api/api";
import type { ApiResponse, ClubMembership } from "@/lib/api/api-type-helpers";

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
	const [postsResponse, alliancesResponse, invitesResponse] = await Promise.all([
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
		user ? apiServer.GET("/api/users/invites") : Promise.resolve({ data: null, error: null }),
	]);

	const posts = postsResponse.data?.posts || [];
	const alliances = alliancesResponse.data?.alliances || [];
	const allUserInvites = invitesResponse.data?.invites || [];
	const clubInvites = allUserInvites.filter((invite) => invite.clubId === club.id);

	if (postsResponse.error) {
		logger.error("Error fetching club posts", { error: postsResponse.error });
	}

	const isClubOwner = currentUserMembership?.role === "CLUB_OWNER";

	return (
		<div>
			<ClubInviteAcceptance invites={clubInvites} />
			{/* Unified Banner Section - Always Present */}
			<div className="relative w-full mb-6">
				<div className="w-full h-full max-h-75 bg-sidebar rounded-md">
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
						<div className="w-full h-full bg-linear-to-br from-sidebar to-muted rounded-md" />
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
				<div className="flex gap-4 items-start">
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
				<div className="border bg-sidebar p-4 space-y-4 rounded-md">
					<h2 className="text-xl font-semibold">{t("Claim this club")}</h2>
					<ClaimClubForm clubId={club.id} clubName={club.name} user={user} />
				</div>
			)}
			{hasOwner && (
				<>
					{(members.length > 0 || alliances.length > 0 || club.instagramUsername) && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{members.length > 0 && (
								<Card className="h-full">
									<CardHeader className="border-b">
										<div className="flex flex-col gap-4">
											<CardTitle>{t("Members")}</CardTitle>
											<p className="text-sm text-muted-foreground">
												{t("All members of this club")}
											</p>
										</div>
									</CardHeader>
									<CardContent className="max-h-150 overflow-auto p-4">
										<div className="grid gap-1">
											{members
												.sort((a, b) => {
													const roleOrder = { CLUB_OWNER: 0, MANAGER: 1, USER: 2 };
													return roleOrder[a.role] - roleOrder[b.role];
												})
												.map((member) => (
													<Link
														key={member.id}
														href={`/users/${member.user.slug || member.user.id}`}
														className="group relative flex items-center gap-3 p-2 rounded-md border border-transparent hover:border-red-500 hover:bg-muted transition-all"
													>
														<Avatar className="w-10 h-10">
															<AvatarImage
																src={member.user.image || undefined}
																alt={member.user.name}
															/>
															<AvatarFallback name={member.user.name} />
														</Avatar>
														<div className="flex flex-col flex-1 min-w-0">
															<div className="flex items-center gap-2">
																<span className="font-medium truncate">
																	{member.user.name}
																</span>
																{member.role === "CLUB_OWNER" && <ClubOwnerIcon />}
																{member.role === "MANAGER" && <ClubManagerIcon />}
															</div>
															{member.user.callsign && (
																<span className="text-sm text-muted-foreground truncate">
																	{member.user.callsign}
																</span>
															)}
														</div>
														<ArrowUpRight className="absolute top-2 right-2 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
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
									</CardContent>
								</Card>
							)}

							{alliances.length > 0 && (
								<Card className="h-full">
									<CardHeader className="border-b">
										<div className="flex flex-col gap-4">
											<CardTitle>{t("Alliances")}</CardTitle>
											<p className="text-sm text-muted-foreground">
												{t("Club alliances and partnerships")}
											</p>
										</div>
									</CardHeader>
									<CardContent className="max-h-100 overflow-auto p-4">
										<div className="grid gap-1">
											{alliances.map((alliance) => {
												const content = (
													<>
														<div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground shrink-0">
															<HandshakeIcon className="h-5 w-5" />
														</div>
														<HoverCard>
															<HoverCardTrigger asChild>
																<div className="flex flex-col flex-1 min-w-0 overflow-hidden">
																	<span className="font-medium block">
																		{alliance.name}
																	</span>
																	{alliance.description && (
																		<span className="text-sm text-muted-foreground truncate block">
																			{alliance.description}
																		</span>
																	)}
																</div>
															</HoverCardTrigger>
															<HoverCardContent className="w-100">
																<div className="space-y-2">
																	<h4 className="font-semibold">{alliance.name}</h4>
																	{alliance.description && (
																		<p className="text-sm text-muted-foreground">
																			{alliance.description}
																		</p>
																	)}
																</div>
															</HoverCardContent>
														</HoverCard>
														{alliance.link && (
															<ArrowUpRight className="absolute top-2 right-2 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
														)}
													</>
												);

												if (alliance.link) {
													return (
														<Link
															key={alliance.id}
															href={alliance.link}
															target="_blank"
															rel="noopener noreferrer"
															className="group relative flex items-center gap-3 p-2 rounded-md border border-transparent transition-all min-w-0 overflow-hidden hover:border-red-500 hover:bg-muted cursor-pointer pr-8"
														>
															{content}
														</Link>
													);
												}

												return (
													<div
														key={alliance.id}
														className="group relative flex items-center gap-3 p-2 rounded-md border border-transparent transition-all min-w-0 overflow-hidden cursor-default hover:bg-muted"
													>
														{content}
													</div>
												);
											})}
										</div>
									</CardContent>
								</Card>
							)}

							<ReviewsOverview type="club" typeId={club.id} entityName={club.name} isMember={isMember} />

							{club.instagramUsername && (
								<Card
									className={members.length > 0 && alliances.length > 0 ? "md:col-span-2" : "h-full"}
								>
									<CardHeader className="border-b">
										<div className="flex flex-col gap-4">
											<div className="flex items-center gap-2">
												<SiInstagram className="h-5 w-5 text-primary" />
												<CardTitle>{t("Instagram photos")}</CardTitle>
											</div>
											<p className="text-sm text-muted-foreground">
												{t("View our latest posts on Instagram")}
											</p>
										</div>
									</CardHeader>
									<CardContent className="flex-1">
										<div className="flex">
											<ClubInstagram data={instagramData} limit={11} />
										</div>
									</CardContent>
								</Card>
							)}
						</div>
					)}

					<div className="space-y-4 mt-8">
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
