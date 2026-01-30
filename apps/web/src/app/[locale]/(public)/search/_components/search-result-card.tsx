import { ArrowUpRight, Building2, Calendar } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
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
	return (
		<Link href={href} className="block group h-full">
			<Card className="relative overflow-hidden transition-all hover:border-red-500 border bg-sidebar h-full flex flex-col">
				<div
					className={cn("flex gap-4 flex-1", {
						"flex-col md:flex-row": type === "club" || type === "event",
						"flex-row": type === "user",
					})}
				>
					<div
						className={cn("relative shrink-0 overflow-hidden", {
							"w-[100px] md:w-[150px] h-[100px] md:h-[150px] rounded-md md:border-r": type === "user",
							"w-full md:w-[150px] h-[200px] md:h-full md:border-r": type === "club" || type === "event",
							"bg-muted": !image && type !== "user",
							"p-2": type === "club",
							"flex items-center justify-center": type === "club",
						})}
					>
						{type === "user" ? (
							<Avatar className="w-full h-full rounded-md">
								<AvatarImage
									src={image || undefined}
									alt={typeof title === "string" ? title : "Image"}
								/>
								<AvatarFallback name={name} />
							</Avatar>
						) : image ? (
							<Image
								src={image}
								alt={typeof title === "string" ? title : "Image"}
								width={IMAGE_SIZES.THUMBNAIL}
								height={IMAGE_SIZES.THUMBNAIL}
								className={cn({
									"object-contain h-full w-full": type === "club",
									"object-cover w-full h-full": type === "event",
								})}
							/>
						) : (
							<div className="w-full h-full bg-muted grid place-items-center aspect-square">
								{
									{
										club: <Building2 className="w-12 h-12 text-muted-foreground" />,
										event: <Calendar className="w-12 h-12 text-muted-foreground" />,
									}[type]
								}
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
