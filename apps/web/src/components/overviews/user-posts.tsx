"use client";

import { Plus } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { InlinePostComposer } from "@/components/posts/InlinePostComposer";
import { PostCard, type PostData } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";

interface UserPostsProps {
	posts: PostData[];
	currentUserId?: string;
	isOwnProfile: boolean;
}

export function UserPosts({ posts, currentUserId, isOwnProfile }: UserPostsProps) {
	const t = useExtracted();
	const [localPosts, setLocalPosts] = useState(posts);
	const [showComposer, setShowComposer] = useState(false);

	const handleDeletePost = async (postId: string) => {
		const response = await fetch(`/api/posts/${postId}`, {
			method: "DELETE",
			credentials: "include",
		});

		if (response.ok) {
			setLocalPosts((prev) => prev.filter((p) => p.id !== postId));
		}
	};

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
				images: data.images || [],
			}),
		});

		if (response.ok) {
			const result = await response.json();
			setLocalPosts((prev) => [result.post, ...prev]);
			setShowComposer(false);
		}
	};

	if (localPosts.length === 0 && !isOwnProfile) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">{t("Posts")}</h2>
				{isOwnProfile && !showComposer && localPosts.length > 0 && (
					<Button variant="outline" size="sm" onClick={() => setShowComposer(true)}>
						<Plus className="h-4 w-4 mr-1" />
						{t("Create post")}
					</Button>
				)}
			</div>

			{isOwnProfile && (localPosts.length === 0 || showComposer) && (
				<div className="border bg-sidebar rounded-lg">
					<InlinePostComposer
						onSubmit={handleCreatePost}
						placeholder={t("Share something with your followers...")}
					/>
				</div>
			)}

			<div className="space-y-4">
				{localPosts.map((post) => (
					<PostCard
						key={post.id}
						post={post}
						currentUserId={currentUserId}
						onPostDeleted={handleDeletePost}
					/>
				))}
			</div>
		</div>
	);
}
