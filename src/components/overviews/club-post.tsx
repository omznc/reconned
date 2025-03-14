"use client";

import { Button } from "@/components/ui/button";
import type { Post } from "@prisma/client";
import { Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { formatRelative } from "date-fns";
import { bs } from "date-fns/locale";
import { useState } from "react";
import "@/components/editor/editor.css";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useOverflow } from "@/hooks/use-overflow";
import DOMPurify from "isomorphic-dompurify";

interface ClubPostProps {
	post: Post & { createdAt: Date };
	clubId: string;
	isManager?: boolean;
}

export function ClubPost({ post, clubId, isManager }: ClubPostProps) {
	const t = useTranslations("components.post");
	const [isExpanded, setIsExpanded] = useState(false);
	const { ref, isOverflowing } = useOverflow();

	return (
		<div className="border bg-sidebar rounded-lg p-4 space-y-3">
			<div className="flex justify-between items-start gap-4">
				<div className="space-y-1">
					<h3 className="font-medium">{post.title}</h3>
					<p className="text-sm text-muted-foreground">
						{t("published", {
							date: formatRelative(post.createdAt, new Date(), {
								locale: bs,
							}),
						})}
					</p>
				</div>
				{isManager && (
					<Button variant="ghost" size="icon" asChild className="shrink-0">
						<Link href={`/dashboard/${clubId}/club/posts?postId=${post.id}`}>
							<Pencil className="h-4 w-4" />
						</Link>
					</Button>
				)}
			</div>
			<div
				ref={ref}
				className={cn(
					"relative",
					!isExpanded && "max-h-[500px] overflow-hidden",
				)}
			>
				<div
					className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 p-4"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: I have to, it's an editor
					dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
				/>
				{post.images?.length > 0 && post.images[0] && (
					<div className="relative w-full">
						<Image
							src={post.images[0]}
							alt={`${post.title} - Slika`}
							width={800}
							height={400}
							className={cn(
								"rounded-md object-cover w-full",
								!isExpanded && "max-h-[400px]",
							)}
						/>
					</div>
				)}
				{!isExpanded && isOverflowing && (
					<div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-sidebar to-transparent pointer-events-none" />
				)}
			</div>
			{isOverflowing && (
				<Button
					variant="ghost"
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full hover:bg-transparent"
				>
					{isExpanded ? t("showLess") : t("readMore")}
				</Button>
			)}
		</div>
	);
}
