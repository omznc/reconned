"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useExtracted } from "next-intl";
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
import { ActionError } from "@/lib/action-error";
import apiClient from "@/lib/api/api.client.ts";
import type { ApiResponse } from "@/lib/api/api-type-helpers.ts";
import { postSchema } from "./posts.schema.ts";

type ClubPost = ApiResponse<"/api/clubs/{id}/posts/{postId}", "get">;

interface PostsFormProps {
	clubId: string;
	editingPost: ClubPost | null;
}

export function PostsForm({ clubId, editingPost }: PostsFormProps) {
	const [_, setPostId] = useQueryState("postId");
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [editorContent, setEditorContent] = useState<string>(editingPost?.post.content ?? "");
	const confirm = useConfirm();
	const t = useExtracted();

	// Initialize file upload system for post images
	const initialFiles: FileUploadItem[] = editingPost?.post.images
		? editingPost.post.images.map((url: string, index: number) => ({
				id: `existing-${index}`,
				url,
				name: `Post image ${index + 1}`,
				type: "image/jpeg",
				isExisting: true,
			}))
		: [];

	const imageUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const { data, error } = await apiClient.POST("/api/clubs/{id}/posts/images/upload-url", {
				params: {
					path: {
						id: clubId,
					},
				},
				body: {
					file: {
						name: file.name,
						type: file.type,
						size: file.size,
					},
				},
			});

			if (error || !data?.url) {
				throw new ActionError(error?.error ?? t("Failed to get upload URL"));
			}

			const response = await fetch(data.url, {
				method: "PUT",
				body: file,
				headers: {
					"Content-Type": file.type,
					"Content-Length": file.size.toString(),
				},
			});

			if (!response.ok) {
				throw new ActionError(
					t("Upload failed with status {status}", {
						status: response.status.toString(),
					}),
				);
			}

			return data.cdnUrl;
		},
		maxFiles: 5,
		initialFiles,
	});

	const form = useForm<z.infer<typeof postSchema>>({
		resolver: zodResolver(postSchema),
		defaultValues: {
			id: editingPost?.post.id,
			title: editingPost?.post.title ?? "",
			content: editorContent,
			images: editingPost?.post.images ?? [],
			isPublic: editingPost?.post.isPublic ?? false,
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
			const uploadedUrls = await imageUpload.uploadAllFiles();
			values.images = uploadedUrls;

			const isEditing = Boolean(values.id);

			const { error } = isEditing
				? await apiClient.PUT("/api/clubs/{id}/posts/{postId}", {
						params: {
							path: {
								id: clubId,
								postId: values.id ?? editingPost?.post.id ?? "",
							},
						},
						body: {
							title: values.title,
							content: values.content,
							images: values.images ?? [],
							isPublic: values.isPublic,
						},
					})
				: await apiClient.POST("/api/clubs/{id}/posts", {
						params: {
							path: {
								id: clubId,
							},
						},
						body: {
							title: values.title,
							content: values.content,
							images: values.images ?? [],
							isPublic: values.isPublic,
						},
					});

			if (error) {
				throw new ActionError(error.error ?? t("An error occurred"));
			}

			imageUpload.markAsSaved();

			form.reset();
			setPostId(null);
			toast.success(values.id ? t("Post successfully modified") : t("Post successfully created"));
		} catch (error) {
			const message = error instanceof Error ? error.message : t("An error occurred");
			toast.error(message);
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
			title: t("Are you sure?"),
			body: t("If you delete a post, you won't be able to get it back."),
			cancelButton: t("Cancel"),
			actionButton: t("Confirm"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		setIsLoading(true);
		try {
			const { error } = await apiClient.DELETE("/api/clubs/{id}/posts/{postId}", {
				params: {
					path: {
						id: clubId,
						postId: editingPost.post.id,
					},
				},
			});

			if (error) {
				throw new ActionError(error.error ?? t("An error occurred while deleting the post"));
			}

			setPostId(null);
			toast.success(t("Post successfully deleted"));
		} catch (error) {
			const message = error instanceof Error ? error.message : t("An error occurred while deleting the post");
			toast.error(message);
		} finally {
			router.back();
		}
		setIsLoading(false);
	};

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">{editingPost ? t("Editing a post") : t("New post")}</h1>
				{editingPost && (
					<Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
						{t("Delete the post")}
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
								<FormLabel>{t("Title")}</FormLabel>
								<FormControl>
									<Input placeholder={t("New post")} {...field} />
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
								<FormLabel>{t("Content")}</FormLabel>
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
								<FormLabel>{t("Images")}</FormLabel>
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
								<FormLabel>{t("Public announcement")}</FormLabel>
								<FormControl>
									<Switch checked={field.value} onCheckedChange={field.onChange} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit" disabled={isLoading}>
						{editingPost ? t("Save changes") : t("Save the post")}
					</Button>
				</form>
			</Form>
		</div>
	);
}
