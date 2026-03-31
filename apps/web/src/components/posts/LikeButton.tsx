"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface LikeButtonProps {
	postId: string;
	initialLikesCount: number;
	initialIsLiked: boolean;
	onUpdate?: (newLikesCount: number, newIsLiked: boolean) => void;
}

export function LikeButton({ postId, initialLikesCount, initialIsLiked, onUpdate }: LikeButtonProps) {
	const [isLiked, setIsLiked] = useState(initialIsLiked);
	const [likesCount, setLikesCount] = useState(initialLikesCount);
	const [isLoading, setIsLoading] = useState(false);

	const handleLike = async () => {
		if (isLoading) return;
		setIsLoading(true);

		const previousLiked = isLiked;
		const previousCount = likesCount;

		setIsLiked(!isLiked);
		setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

		try {
			const response = await fetch(`/api/posts/${postId}/like`, { method: "POST", credentials: "include" });
			const data = (await response.json()) as { liked: boolean };

			setIsLiked(data.liked);
			setLikesCount(data.liked ? likesCount + 1 : likesCount - 1);
			onUpdate?.(data.liked ? likesCount + 1 : likesCount - 1, data.liked);
		} catch {
			setIsLiked(previousLiked);
			setLikesCount(previousCount);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Button variant="ghost" size="sm" className="gap-2" onClick={handleLike} disabled={isLoading}>
			<Heart className={isLiked ? "h-4 w-4 fill-current text-red-500" : "h-4 w-4"} />
			<span>{likesCount}</span>
		</Button>
	);
}
