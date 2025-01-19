"use client";

import { Button } from "@/components/ui/button";
import type { Post } from "@prisma/client";
import { Pencil } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatRelative } from "date-fns";
import { bs } from "date-fns/locale";
import { useState } from "react";
import "@/components/editor/editor.css";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ClubPostProps {
	post: Post & { createdAt: Date; };
	clubId: string;
	isManager?: boolean;
}

function isLongContent(content: string): boolean {
	// Check if content has multiple paragraphs or lots of text
	if (!content) {
		return false;
	}

	const paragraphs = content.split("\n");
	if (paragraphs.length > 7) {
		return true;
	}

	return false;
}

export function ClubPost({ post, clubId, isManager }: ClubPostProps) {
	const t = useTranslations("components.post");
	const [isExpanded, setIsExpanded] = useState(false);
	const content = post.content;
	const isOverflowing = isLongContent(content);

	return (
		<div className="border bg-sidebar rounded-lg p-4 space-y-3">
			<div className="flex justify-between items-start gap-4">
				<div className="space-y-1">
					<h3 className="font-medium">{post.title}</h3>
					<p className="text-sm text-muted-foreground">
						{t("published", {
							date: formatRelative(post.createdAt, new Date(), {
								locale: bs,
							})
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
				className={isExpanded ? "" : "max-h-[300px] overflow-hidden relative"}
			>
				<div
					className={cn(
						"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 p-4",
					)}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
					dangerouslySetInnerHTML={{ __html: content }}
				/>
				{!isExpanded && isOverflowing && (
					<div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-sidebar to-transparent" />
				)}
			</div>
			{isOverflowing && (
				<Button
					variant="ghost"
					onClick={() => setIsExpanded(!isExpanded)}
					className="w-full"
				>
					{isExpanded ? t("showLess") : t("readMore")}
				</Button>
			)}
			{post.images?.length > 0 && (
				<div className="grid grid-cols-2 gap-2">
					{post.images.map((image, i) => (
						<Image
							key={image}
							src={image}
							alt={`Image ${i + 1}`}
							width={300}
							height={200}
							className="rounded-md object-cover"
						/>
					))}
				</div>
			)}
		</div>
	);
}
