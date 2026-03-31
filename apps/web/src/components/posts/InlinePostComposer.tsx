"use client";

import { Globe, Lock, Upload, X } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InlinePostComposerProps {
	onSubmit: (data: { content: string; title?: string; images: string[]; isPublic?: boolean }) => Promise<void>;
	clubId?: string;
	clubName?: string;
	placeholder?: string;
	className?: string;
}

export function InlinePostComposer({ onSubmit, clubId, clubName, placeholder, className }: InlinePostComposerProps) {
	const t = useExtracted();
	const [content, setContent] = useState("");
	const [title, setTitle] = useState("");
	const [images, setImages] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isPublic, setIsPublic] = useState(true);
	const [isDragging, setIsDragging] = useState(false);

	const uploadImage = async (file: File): Promise<string | null> => {
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

		if (!uploadResponse.ok) return null;

		const { url, cdnUrl } = await uploadResponse.json();
		await fetch(url, {
			method: "PUT",
			body: file,
			headers: { "Content-Type": file.type },
		});
		return cdnUrl;
	};

	const onDrop = useCallback(async (acceptedFiles: File[]) => {
		setIsDragging(false);
		for (const file of acceptedFiles) {
			if (!file.type.startsWith("image/")) continue;
			if (file.size > 5 * 1024 * 1024) continue;

			const cdnUrl = await uploadImage(file);
			if (cdnUrl) {
				setImages((prev) => [...prev, cdnUrl]);
			}
		}
	}, []);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: { "image/*": [] },
		multiple: true,
		disabled: isSubmitting,
		onDragEnter: () => setIsDragging(true),
		onDragLeave: () => setIsDragging(false),
	});

	const handleSubmit = async () => {
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
		<div className={cn("space-y-3 p-4", className)}>
			{clubName && <p className="text-sm text-muted-foreground">{t("Posting in {clubName}", { clubName })}</p>}

			<input
				type="text"
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder={t("Title (optional)")}
				className="w-full bg-transparent border-none text-lg font-medium focus:outline-none placeholder:text-muted-foreground"
				maxLength={200}
			/>

			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				placeholder={placeholder || t("What's on your mind?")}
				className="w-full min-h-[80px] bg-transparent border-none resize-none focus:outline-none placeholder:text-muted-foreground"
			/>

			{images.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{images.map((src, index) => (
						<div key={src} className="relative group">
							<Image
								src={src}
								alt=""
								width={80}
								height={80}
								className="w-20 h-20 object-cover rounded-lg"
							/>
							<button
								type="button"
								onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
								className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}

			<div
				{...getRootProps()}
				className={cn(
					"border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer",
					isDragActive || isDragging
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 hover:border-muted-foreground/50",
					isSubmitting && "opacity-50 cursor-not-allowed",
				)}
			>
				<input {...getInputProps()} />
				<div className="flex flex-col items-center justify-center space-y-1 text-center">
					<Upload className="w-5 h-5 text-muted-foreground" />
					<p className="text-xs text-muted-foreground">{t("Click to upload or drag and drop images")}</p>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row items-center justify-between gap-3 -mx-4 px-4 pt-3 border-t">
				<div className="flex items-center gap-2">
					{clubId && (
						<div className="flex items-center gap-1 border rounded-md p-0.5">
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

				<Button
					onClick={handleSubmit}
					size="sm"
					disabled={!content.trim() || isSubmitting}
					className="w-full md:w-1/2"
				>
					{isSubmitting ? t("Posting...") : t("Post")}
				</Button>
			</div>
		</div>
	);
}
