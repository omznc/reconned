"use client";

import { Globe, Image as ImageIcon, Lock, X } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PostComposerProps {
	onSubmit: (data: { content: string; title?: string; images: string[]; isPublic?: boolean }) => Promise<void>;
	clubId?: string;
	clubName?: string;
	placeholder?: string;
	compact?: boolean;
	className?: string;
}

export function PostComposer({
	onSubmit,
	clubId,
	clubName,
	placeholder,
	compact = false,
	className,
}: PostComposerProps) {
	const t = useExtracted();
	const [content, setContent] = useState("");
	const [title, setTitle] = useState("");
	const [images, setImages] = useState<string[]>([]);
	const [uploadingImages, setUploadingImages] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPublic, setIsPublic] = useState(true);

	const handleImageUpload = async (file: File) => {
		try {
			const uploadResponse = await fetch("/api/posts/images/upload-url", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					file: {
						name: file.name,
						type: file.type,
						size: file.size,
					},
				}),
			});

			if (!uploadResponse.ok) {
				throw new Error("Failed to get upload URL");
			}

			const { url, cdnUrl } = await uploadResponse.json();

			await fetch(url, {
				method: "PUT",
				body: file,
				headers: { "Content-Type": file.type },
			});

			setImages((prev) => [...prev, cdnUrl]);
		} catch (error) {
			console.error("Failed to upload image:", error);
		} finally {
			setUploadingImages((prev) => prev.filter((u) => u !== file.name));
		}
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files) return;

		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) continue;
			if (file.size > 5 * 1024 * 1024) continue;

			setUploadingImages((prev) => [...prev, file.name]);
			await handleImageUpload(file);
		}

		e.target.value = "";
	};

	const removeImage = (index: number) => {
		setImages((prev) => prev.filter((_, i) => i !== index));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || isSubmitting) return;

		setIsSubmitting(true);
		try {
			await onSubmit({ content, title: title || undefined, images, isPublic: clubId ? isPublic : true });
			setContent("");
			setTitle("");
			setImages([]);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className={cn("space-y-3", className)}>
			{clubName && <p className="text-sm text-muted-foreground">{t("Posting in {clubName}", { clubName })}</p>}

			<Textarea
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Title (optional)"
				className="font-medium"
				maxLength={200}
			/>

			<Textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				placeholder={placeholder || t("What's on your mind?")}
				className="min-h-[100px]"
			/>

			{images.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{images.map((src, index) => (
						<div key={src} className="relative">
							<Image
								src={src}
								alt=""
								width={80}
								height={80}
								className="w-20 h-20 object-cover rounded-md"
							/>
							<button
								type="button"
								onClick={() => removeImage(index)}
								className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}

			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<label className="cursor-pointer">
						<input
							type="file"
							accept="image/*"
							multiple
							onChange={handleFileChange}
							className="hidden"
							disabled={uploadingImages.length > 0}
						/>
						<Button type="button" variant="ghost" size="sm" asChild disabled={uploadingImages.length > 0}>
							<span>
								<ImageIcon className="h-4 w-4 mr-2" />
								{uploadingImages.length > 0 ? t("Uploading...") : t("Add image")}
							</span>
						</Button>
					</label>

					{clubId && (
						<div className="flex items-center gap-1 border rounded-md px-2 py-1">
							<button
								type="button"
								onClick={() => setIsPublic(true)}
								className={cn(
									"flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
									isPublic
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted",
								)}
							>
								<Globe className="h-3 w-3" />
								{t("Public")}
							</button>
							<button
								type="button"
								onClick={() => setIsPublic(false)}
								className={cn(
									"flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors",
									!isPublic
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted",
								)}
							>
								<Lock className="h-3 w-3" />
								{t("Club only")}
							</button>
						</div>
					)}
				</div>

				<Button type="submit" size="sm" disabled={!content.trim() || isSubmitting}>
					{isSubmitting ? t("Posting...") : t("Post")}
				</Button>
			</div>
		</form>
	);
}
