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
} from "lucide-react";
import { getExtracted } from "next-intl/server";
import { ClaimClubForm } from "@/components/claim-club-form";
import { ClubInviteAcceptance } from "@/components/club-invite-acceptance";
import { ClubManagerIcon, ClubOwnerIcon, InstagramIcon, VerifiedClubIcon } from "@/components/icons";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { ProfileBanner } from "@/components/identity/profile-banner";
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
import type { ApiResponse, ClubMembership, EventInvite } from "@/lib/api/api-type-helpers";

interface ClubOverviewProps {
	club: ApiResponse<"/api/clubs/{id}", "get">;
	isManager?: boolean;
	isMember?: boolean;
	currentUserMembership?: ClubMembership | null;
	hasOwner?: boolean;
	user?: { id: string; name: string; email: string; callsign?: string | null } | null;
	members?: ApiResponse<"/api/clubs/{id}/members", "get">["members"];
	privateCount?: number;
	posts?: ApiResponse<"/api/clubs/{id}/posts", "get">["posts"];
	alliances?: ApiResponse<"/api/clubs/{id}/alliances", "get">["alliances"];
	instagramData?: ApiResponse<"/api/clubs/{id}/instagram/media", "get">;
	invites?: EventInvite[];
}

export async function ClubOverview({
	club,
	isManager,
	isMember,
	currentUserMembership,
	hasOwner = true,
	user,
	members = [],
	privateCount = 0,
	posts = [],
	alliances = [],
	instagramData = { media: [], username: club.instagramUsername || null },
	invites = [],
}: ClubOverviewProps) {
	const t = await getExtracted();

	const isClubOwner = currentUserMembership?.role === "CLUB_OWNER";

	return (
		<div>
			<ClubInviteAcceptance invites={invites} />

			<ProfileBanner
				name={club.name}
				kind="club"
				image={club.headerImage}
				action={
					isManager && (
						<Button asChild size="sm">
							<Link href={`/dashboard/${club.id}/club/information`}>
								<Cog className="h-4 w-4 mr-2" />
								{t("Edit club")}
							</Link>
						</Button>
					)
				}
			/>

			<div className="flex flex-col gap-6">
				<div className="px-4 sm:px-6">
					{/* Square mark, overhanging the banner by half its height. */}
					<div className="relative z-1 -mt-14 w-28 h-28 rounded-[29px] bg-background p-[5px] shadow-lg">
						<ClubAvatar
							name={club.name}
							logo={club.logo}
							tile={club.logoTile}
							size={112}
							radius={24}
							fill
							priority
						/>
					</div>

					<h1 className="text-3xl flex gap-2 items-center font-semibold mt-4 mb-2">
						{club.name} {club.verified && <VerifiedClubIcon />}
					</h1>
					<ExpandableDescription description={club.description || ""} />
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
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 grid-span-last-odd">
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
								<Card className="h-full">
									<CardHeader className="border-b">
										<div className="flex flex-col gap-4">
											<div className="flex items-center gap-2">
												<InstagramIcon className="h-5 w-5 text-primary" />
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
