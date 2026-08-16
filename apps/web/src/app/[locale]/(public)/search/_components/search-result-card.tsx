import { ArrowUpRight, Calendar } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { IMAGE_SIZES } from "@/lib/image-sizes";
import { cn } from "@/lib/utils";

interface SearchResultCardProps {
	title: ReactNode;
	description?: string | null;
	href: string;
	badges?: string[];
	meta?: string;
	image?: string | null;
	type: "club" | "user" | "event";
	name?: string;
}

export function SearchResultCard({ title, description, href, badges, meta, image, type, name }: SearchResultCardProps) {
	/*
	 * A person is a row: circular avatar, name, then the rest. Framing a face in
	 * the same bordered square panel a club logo gets made the two read alike,
	 * which is exactly the distinction the identity system keeps.
	 */
	if (type === "user") {
		return (
			<Link href={href} className="group block h-full">
				<Card className="relative flex items-center gap-4 overflow-hidden border bg-sidebar p-4 pr-12 transition-all hover:border-red-500">
					<Avatar className="size-14 shrink-0">
						<AvatarImage src={image || undefined} alt="" />
						<AvatarFallback name={name} />
					</Avatar>
					<div className="flex min-w-0 flex-1 flex-col">
						<CardTitle className="truncate text-lg">{title}</CardTitle>
						{description && <CardDescription className="truncate">{description}</CardDescription>}
						<div className="mt-2 flex flex-wrap items-center gap-2">
							{badges?.map((badge) => (
								<Badge key={badge} variant="outline" className="bg-background/50">
									{badge}
								</Badge>
							))}
							{meta && <span className="truncate text-sm text-muted-foreground">{meta}</span>}
						</div>
					</div>
					<ArrowUpRight className="absolute top-4 right-4 h-5 w-5 text-red-500 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
				</Card>
			</Link>
		);
	}

	return (
		<Link href={href} className="block group h-full">
			<Card className="relative overflow-hidden transition-all hover:border-red-500 border bg-sidebar h-full flex flex-col">
				<div className="flex flex-col md:flex-row gap-4 flex-1">
					<div
						className={cn(
							"relative shrink-0 overflow-hidden w-full md:w-[150px] h-[200px] md:h-full md:border-r",
							{
								"bg-muted": !image && type === "event",
								"p-2 flex items-center justify-center": type === "club",
							},
						)}
					>
						{type === "club" ? (
							<ClubAvatar
								name={typeof title === "string" ? title : name || ""}
								logo={image}
								size={130}
								fill
							/>
						) : image ? (
							<Image
								src={image}
								alt={typeof title === "string" ? title : "Image"}
								width={IMAGE_SIZES.THUMBNAIL}
								height={IMAGE_SIZES.THUMBNAIL}
								className="object-cover w-full h-full"
							/>
						) : (
							<div className="w-full h-full bg-muted grid place-items-center aspect-square">
								<Calendar className="w-12 h-12 text-muted-foreground" />
							</div>
						)}
					</div>

					<div className="flex-1 p-4 pr-12 flex flex-col min-w-0 overflow-hidden">
						<CardTitle className="text-lg mb-2 line-clamp-2 break-all">{title}</CardTitle>
						{description && (
							<CardDescription className="line-clamp-2 mb-3 break-all overflow-hidden">
								{description}
							</CardDescription>
						)}
						<div className="flex flex-wrap items-center gap-2 mt-auto">
							{badges?.map((badge) => (
								<Badge key={badge} variant="outline" className="bg-background/50">
									{badge}
								</Badge>
							))}
							{meta && <span className="text-sm text-muted-foreground break-all">{meta}</span>}
						</div>
					</div>

					<ArrowUpRight className="absolute top-4 right-4 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</div>
			</Card>
		</Link>
	);
}
