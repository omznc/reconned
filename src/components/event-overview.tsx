import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Event } from "@prisma/client";
import { Eye, EyeOff, Pencil, Pin, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface EventOverviewProps {
	event: Event & {
		_count: {
			invites: number;
			registrations: number;
		};
	};
	clubId?: string;
}

export function EventOverview({ event, clubId }: EventOverviewProps) {
	return (
		<div className="relative flex flex-col items-center justify-center gap-4 ">
			<Eye className="size-8 z-20 text-black bg-white border p-0.5 absolute top-4 right-4 peer" />
			<Image
				suppressHydrationWarning={true}
				src={`${event.coverImage}?v=${event.updatedAt}`} // This will revalidate the browser cache
				alt={event.name}
				width={680}
				height={380}
				className="object-cover transition-all w-full h-auto"
				draggable={false}
				priority={true}
			/>
			<div className="absolute peer-hover:opacity-25 peer-hover:top-[80%] border border-b-0 transition-all h-4/5 min-h-fit p-4 top-1/4 bg-background w-3/4 flex flex-col gap-1">
				<div className="relative flex select-none flex-col gap-3">
					{clubId && (
						<Button asChild={true}>
							<Link
								className="absolute top-0 right-0 flex items-center gap-1 h-fit w-fit"
								href={`/dashboard/${clubId}/events/create?id=${event.id}`}
							>
								<Pencil className="size-4" />
								Izmjeni susret
							</Link>
						</Button>
					)}
					<h1
						data-editable={Boolean(clubId)}
						className="text-4xl font-semibold w-full data-[editable=true]:w-[calc(100%-150px)]"
					>
						{event.name}
					</h1>
					<div className="flex flex-wrap gap-1 -mt-2">
						<Badge variant="outline" className="flex h-fit items-center gap-1">
							<User className="size-4" />
							{event._count?.invites + event._count?.registrations}
						</Badge>
						<Badge variant="outline" className="flex h-fit items-center gap-1">
							{event.isPrivate ? (
								<>
									<EyeOff className="size-4" />
									Privatni susret
								</>
							) : (
								<>
									<Eye className="size-4" />
									Javni susret
								</>
							)}
						</Badge>
						{event.location && (
							<Badge
								variant="outline"
								className="flex h-fit items-center gap-1"
							>
								<Pin className="size-4" />
								{event.location}
							</Badge>
						)}
					</div>
					<p className="text-accent-foreground/80">{event.description}</p>
					{event.googleMapsLink && (
						<iframe
							src={event.googleMapsLink}
							loading="lazy"
							referrerPolicy="no-referrer-when-downgrade"
							className="w-full h-96 border"
							title="Google Maps"
						/>
					)}
				</div>
			</div>
		</div>
	);
}
