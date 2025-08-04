"use client";

import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/editor";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import type { Post } from "@generated/client";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { postSchema } from "./posts.schema.ts";
import { savePost, deletePost, getPostImageUploadUrl } from "./posts.action.ts";
import { useQueryState } from "nuqs";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FileDrop, type FileUploadProgress } from "@/components/ui/file-drop";

interface PostsFormProps {
	clubId: string;
	editingPost: Post | null;
}

export function PostsForm({ clubId, editingPost }: PostsFormProps) {
	const [postId, setPostId] = useQueryState("postId");
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [editorContent, setEditorContent] = useState<string>(editingPost?.content ?? "");
	const [uploadedUrls, setUploadedUrls] = useState<string[]>(editingPost?.images || []);
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.posts");

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

	const handleUpload = async (file: File): Promise<string | null> => {
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
	};

	const handleUrlsChange = (urls: string[]) => {
		setUploadedUrls(urls);
		form.setValue("images", urls);
	};

	async function onSubmit(values: z.infer<typeof postSchema>) {
		setIsLoading(true);
		try {
			const postData = {
				...values,
				images: uploadedUrls,
			};
			await savePost(postData);
			form.reset();
			setPostId(null);
			setUploadedUrls([]);
			toast.success(values.id ? t("successCreated") : t("successEdited"));
		} catch (error) {
			toast.error(t("error"));
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
			title: t("delete.title"),
			body: t("delete.body"),
			cancelButton: t("delete.cancel"),
			actionButton: t("delete.confirm"),
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
			toast.success(t("delete.success"));
		} catch (error) {
			toast.error(t("delete.error"));
		} finally {
			router.back();
		}
		setIsLoading(false);
	};

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">{editingPost ? t("editing") : t("creating")}</h1>
				{editingPost && (
					<Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
						{t("delete.confirm")}
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
								<FormLabel>{t("title")}</FormLabel>
								<FormControl>
									<Input placeholder={t("creating")} {...field} />
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
								<FormLabel>{t("content")}</FormLabel>
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
								<FormLabel>Slike</FormLabel>
								<FormControl>
									<FileDrop
										uploadedUrls={uploadedUrls}
										onUrlsChange={handleUrlsChange}
										onUpload={handleUpload}
										maxFiles={5}
										acceptedTypes={{
											"image/*": [".jpg", ".jpeg", ".png", ".webp"],
										}}
										disabled={isLoading}
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
								<FormLabel>{t("public")}</FormLabel>
								<FormControl>
									<Switch checked={field.value} onCheckedChange={field.onChange} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button type="submit" disabled={isLoading}>
						{editingPost ? t("saveNewPost") : t("saveEditPost")}
					</Button>
				</form>
			</Form>
		</div>
	);
}
