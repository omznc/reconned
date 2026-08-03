import { ArrowUpRight, Building2, MapPin } from "lucide-react";
import Image from "next/image";
import { VerifiedClubIcon } from "@/components/icons";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { IMAGE_SIZES } from "@/lib/image-sizes";

interface ClubCardProps {
	club: {
		id: string;
		name: string;
		slug: string | null;
		logo: string | null;
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
						{club.logo ? (
							<Image
								src={club.logo}
								alt={club.name}
								width={IMAGE_SIZES.THUMBNAIL}
								height={IMAGE_SIZES.THUMBNAIL}
								sizes="150px"
								className="object-contain h-full w-full"
							/>
						) : (
							<Building2 className="w-12 h-12 text-muted-foreground" />
						)}
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
