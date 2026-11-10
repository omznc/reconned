import { ArrowUpRight, MapPin } from "lucide-react";
import { VerifiedClubIcon } from "@/components/icons";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { LogoTile } from "@/lib/identity";

interface ClubCardProps {
	club: {
		id: string;
		name: string;
		slug: string | null;
		logo: string | null;
		logoTile?: LogoTile | null;
		verified: boolean;
		location?: string | null;
		description?: string | null;
	};
	showDescription?: boolean;
}

export async function ClubCard({ club, showDescription = false }: ClubCardProps) {
	return (
		<Link href={`/clubs/${club.slug || club.id}`} className="block group max-w-md">
			<Card className="relative overflow-hidden transition-colors hover:border-red-500 border bg-sidebar flex">
				<div className="flex gap-4 flex-1">
					<div className="relative shrink-0 w-[150px] h-full border-r bg-muted p-2 flex items-center justify-center">
						<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={130} fill />
					</div>

					<div className="flex-1 p-4 pr-12 flex flex-col min-w-0 overflow-hidden">
						<CardTitle className="text-lg mb-2 flex items-center gap-2 flex-wrap">
							{club.name}
							{club.verified && <VerifiedClubIcon />}
						</CardTitle>
						{showDescription && club.description && (
							<CardDescription className="line-clamp-2 mb-3 overflow-hidden">
								{club.description}
							</CardDescription>
						)}
						{club.location && (
							<div className="flex items-center text-sm text-muted-foreground mt-auto">
								<MapPin className="w-4 h-4 mr-1.5 shrink-0" />
								<span className="truncate">{club.location}</span>
							</div>
						)}
					</div>

					<ArrowUpRight className="absolute top-4 right-4 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-[opacity,translate] transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</div>
			</Card>
		</Link>
	);
}
