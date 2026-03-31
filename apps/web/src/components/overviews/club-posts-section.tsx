"use client";

import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ClubPost } from "@/components/overviews/club-post";
import { InlinePostComposer } from "@/components/posts/InlinePostComposer";
import { Button } from "@/components/ui/button";
import type { Post } from "@/lib/api/api-type-helpers";

interface ClubPostsSectionProps {
	posts: Post[];
	clubId: string;
	clubName: string;
	isMember: boolean;
	isManager: boolean;
}

export function ClubPostsSection({ posts, clubId, clubName, isMember, isManager }: ClubPostsSectionProps) {
	const t = useExtracted();
	const [localPosts, setLocalPosts] = useState(posts);
	const [showComposer, setShowComposer] = useState(false);

	const handleCreatePost = async (data: {
		content: string;
		title?: string;
		images: string[];
		isPublic?: boolean;
	}) => {
		const response = await fetch("/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({
				...data,
				clubId,
				images: data.images || [],
			}),
		});

		if (response.ok) {
			const result = await response.json();
			setLocalPosts((prev) => [result.post, ...prev]);
			setShowComposer(false);
		}
	};

	return (
		<div className="space-y-4 mt-8">
			<div className="flex h-10 items-center justify-between">
				<h2 className="text-xl font-semibold flex items-center gap-2">{t("Announcements")}</h2>
				{isMember && !showComposer && localPosts.length > 0 && (
					<Button variant="outline" size="sm" onClick={() => setShowComposer(true)}>
						<Plus className="h-4 w-4 mr-1" />
						{t("New post")}
					</Button>
				)}
			</div>
			{isMember && (localPosts.length === 0 || showComposer) && (
				<div className="border bg-sidebar rounded-lg">
					<InlinePostComposer
						onSubmit={handleCreatePost}
						clubId={clubId}
						clubName={clubName}
						placeholder={t("Write something to your club...")}
					/>
				</div>
			)}
			{(!localPosts || localPosts.length === 0) && !showComposer && isMember && (
				<p className="text-muted-foreground">{t("There are no posts")}</p>
			)}

			<div className="space-y-4">
				{localPosts.map((post) => (
					<ClubPost key={post.id} post={post} clubId={clubId} isManager={isManager} />
				))}
			</div>
		</div>
	);
}
