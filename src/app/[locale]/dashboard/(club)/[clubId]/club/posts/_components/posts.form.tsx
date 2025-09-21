"use client";

import type { Post } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { Editor } from "@/components/editor/editor";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { FileUpload, type FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRouter } from "@/i18n/navigation";
import { deletePost, getPostImageUploadUrl, savePost } from "./posts.action.ts";
import { postSchema } from "./posts.schema.ts";

interface PostsFormProps {
	clubId: string;
	editingPost: Post | null;
}

export function PostsForm({ clubId, editingPost }: PostsFormProps) {
	const [_, setPostId] = useQueryState("postId");
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [editorContent, setEditorContent] = useState<string>(editingPost?.content ?? "");
	const confirm = useConfirm();
	const t = useTranslations();

	// Initialize file upload system for post images
	const initialFiles: FileUploadItem[] = editingPost?.images
		? editingPost.images.map((url, index) => ({
				id: `existing-${index}`,
				url,
				name: `Post image ${index + 1}`,
				type: "image/jpeg",
				isExisting: true,
			}))
		: [];

	const imageUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const resp = await getPostImageUploadUrl({
				file: {
					type: file.type,
					size: file.size,
					name: file.name,
				},
				clubId,
			});

			if (!resp?.data?.url) {
				throw new Error("Failed to get upload URL");
			}

			const response = await fetch(resp.data.url, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type,
					"Content-Length": file.size.toString(),
				},
			});

			if (!response.ok) {
				throw new Error(`Upload failed with status ${response.status}`);
			}

			return resp.data.cdnUrl;
		},
		maxFiles: 5,
		initialFiles,
	});

	const form = useForm<z.infer<typeof postSchema>>({
		resolver: zodResolver(postSchema),
		defaultValues: {
			id: editingPost?.id,
			title: editingPost?.title ?? "",
			content: editorContent,
			images: editingPost?.images ?? [],
			isPublic: editingPost?.isPublic ?? false,
			clubId,
		},
	});

	function handleEditorChange(content: string) {
		setEditorContent(content);
		form.setValue("content", content, { shouldValidate: true });
	}

	async function onSubmit(values: z.infer<typeof postSchema>) {
		setIsLoading(true);
		try {
			// Upload any new images
			const uploadedUrls = await imageUpload.uploadAllFiles();
			values.images = uploadedUrls;

			await savePost(values);

			// Mark files as saved and clear unsaved changes
			imageUpload.markAsSaved();

			form.reset();
			setPostId(null);
			toast.success(
				values.id ? t("dashboard.club.posts.successEdited") : t("dashboard.club.posts.successCreated"),
			);
		} catch (error) {
			toast.error(t("dashboard.club.posts.error"));
		} finally {
			if (values.id) {
				router.back();
			}
		}
		setIsLoading(false);
	}

	const handleDelete = async () => {
		if (!editingPost) {
			return;
		}

		const confirmed = await confirm({
			title: t("dashboard.club.posts.delete.title"),
			body: t("dashboard.club.posts.delete.body"),
			cancelButton: t("common.actions.cancel"),
			actionButton: t("common.actions.confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		setIsLoading(true);
		try {
			await deletePost({
				postId: editingPost.id,
				clubId,
			});
			setPostId(null);
			toast.success(t("dashboard.club.posts.delete.success"));
		} catch (error) {
			toast.error(t("dashboard.club.posts.delete.error"));
		} finally {
			router.back();
		}
		setIsLoading(false);
	};

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">
					{editingPost ? t("dashboard.club.posts.editing") : t("dashboard.club.posts.creating")}
				</h1>
				{editingPost && (
					<Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
						{t("dashboard.club.posts.delete.confirm")}
					</Button>
				)}
			</div>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="title"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("dashboard.club.posts.title")}</FormLabel>
								<FormControl>
									<Input placeholder={t("dashboard.club.posts.creating")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="content"
						render={() => (
							<FormItem>
								<FormLabel>{t("dashboard.club.posts.content")}</FormLabel>
								<FormControl>
									<Editor editable initialValue={editorContent} onChange={handleEditorChange} />
								</FormControl>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="images"
						render={() => (
							<FormItem>
								<FormLabel>{t("dashboard.club.posts.images")}</FormLabel>
								<FormControl>
									<FileUpload
										value={imageUpload.files}
										onChange={imageUpload.setFiles}
										maxFiles={5}
										maxFileSize={5 * 1024 * 1024}
										accept={{
											"image/*": [".jpg", ".jpeg", ".png", ".webp"],
										}}
										multiple={true}
										showPreview={true}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="isPublic"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("dashboard.club.posts.public")}</FormLabel>
								<FormControl>
									<Switch checked={field.value} onCheckedChange={field.onChange} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit" disabled={isLoading}>
						{editingPost ? t("dashboard.club.posts.saveEditPost") : t("dashboard.club.posts.saveNewPost")}
					</Button>
				</form>
			</Form>
		</div>
	);
}
