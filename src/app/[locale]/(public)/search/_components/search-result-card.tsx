import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { ArrowUpRight, Building2, Calendar, User } from "lucide-react";
import type { ReactNode } from "react";

interface SearchResultCardProps {
	title: ReactNode;
	description?: string | null;
	href: string;
	badges?: string[];
	meta?: string;
	image?: string | null;
	type: "club" | "user" | "event";
}

export function SearchResultCard({
	title,
	description,
	href,
	badges,
	meta,
	image,
	type,
}: SearchResultCardProps) {
	return (
		<Link href={href} className="block group">
			<Card className="relative overflow-hidden transition-all hover:border-red-500 border bg-sidebar">
				<div className="flex flex-col md:flex-row gap-4">
					<div
						className={cn(
							"relative w-full md:w-[150px] h-[200px] md:h-[150px] shrink-0 md:border-r overflow-hidden",
							!image && "bg-muted",
						)}
					>
						{image ? (
							<>
								<Image
									src={image}
									alt={typeof title === "string" ? title : "Image"}
									fill
									className={cn({
										"object-cover h-full": type !== "club",
										"object-contain": type === "club",
									})}
								/>
								<div className="absolute inset-0 bg-linear-to-t from-background/60 to-transparent" />
							</>
						) : (
							<div className="w-full h-full bg-muted grid place-items-center">
								{
									{
										club: (
											<Building2 className="w-12 h-12 text-muted-foreground" />
										),
										user: <User className="w-12 h-12 text-muted-foreground" />,
										event: (
											<Calendar className="w-12 h-12 text-muted-foreground" />
										),
									}[type]
								}
							</div>
						)}
					</div>

					<div className="flex-1 p-4 pr-12">
						<CardTitle className="text-lg mb-2">{title}</CardTitle>
						{description && (
							<CardDescription className="line-clamp-2 mb-3 text-ellipsis">
								{description}
							</CardDescription>
						)}
						<div className="flex flex-wrap items-center gap-2">
							{badges?.map((badge) => (
								<Badge
									key={badge}
									variant="outline"
									className="bg-background/50"
								>
									{badge}
								</Badge>
							))}
							{meta && (
								<span className="text-sm text-muted-foreground">{meta}</span>
							)}
						</div>
					</div>

					<ArrowUpRight className="absolute top-4 right-4 w-5 h-5 text-red-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
				</div>
			</Card>
		</Link>
	);
}
