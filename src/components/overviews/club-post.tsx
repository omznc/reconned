"use client";

import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/editor";
import type { Post } from "@prisma/client";
import { Pencil } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { useState } from "react";
import type { JSONContent } from "novel";

interface ClubPostProps {
	post: Post & { createdAt: Date };
	clubId: string;
	isManager?: boolean;
}

function isLongContent(content: JSONContent): boolean {
	// Check if content has multiple paragraphs or lots of text
	if (!content.content) {
		return false;
	}

	// Count total text length across all nodes
	let totalLength = 0;
	for (const node of content.content) {
		if (node.type === "paragraph" && node.content) {
			for (const textNode of node.content) {
				if (textNode.type === "text" && textNode.text) {
					totalLength += textNode.text.length;
				}
			}
		}
	}

	// Consider content long if it has more than 300 characters
	return totalLength > 300;
}

export function ClubPost({ post, clubId, isManager }: ClubPostProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const content = post.content as JSONContent;
	const isOverflowing = isLongContent(content);

	return (
		<div className="border bg-sidebar rounded-lg p-4 space-y-3">
			<div className="flex justify-between items-start gap-4">
				<div className="space-y-1">
					<h3 className="font-medium">{post.title}</h3>
					<p className="text-sm text-muted-foreground">
						{`Dodano/promjenjeno ${format(
							post.updatedAt,
							"dd.MM.yyyy 'u' HH:mm",
							{
								locale: bs,
							},
						)}`}
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
				<Editor editable={false} initialValue={content} />
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
					{isExpanded ? "Prikaži manje" : "Pročitaj više"}
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
