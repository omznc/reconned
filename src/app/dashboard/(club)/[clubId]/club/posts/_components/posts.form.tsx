"use client";

import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/editor";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import type { Post } from "@prisma/client";
import {
	Form,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
} from "@/components/ui/form";
import { useEditor, type JSONContent } from "novel";
import { postSchema } from "./posts.schema";
import { savePost, deletePost } from "./posts.action";
import { useQueryState } from "nuqs";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ui/alert-dialog-provider";

interface PostsFormProps {
	clubId: string;
	editingPost: Post | null;
}

export function PostsForm({ clubId, editingPost }: PostsFormProps) {
	const [postId, setPostId] = useQueryState("postId");
	const [isLoading, setIsLoading] = useState(false);
	const { editor } = useEditor();
	const [editorContent, setEditorContent] = useState<JSONContent>(
		(editingPost?.content as JSONContent) ?? {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [],
				},
			],
		},
	);
	const confirm = useConfirm();

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

	function handleEditorChange(content: JSONContent) {
		setEditorContent(content);
		form.setValue("content", content, { shouldValidate: true });
	}

	async function onSubmit(values: z.infer<typeof postSchema>) {
		setIsLoading(true);
		try {
			// @ts-expect-error
			await savePost(values);
			form.reset();
			editor?.commands.clearContent(true);
			setPostId(null);
			toast.success(
				values.id
					? "Objava je uspješno izmijenjena"
					: "Objava je uspješno sačuvana",
			);
		} catch (error) {
			toast.error("Greška pri čuvanju objave");
		}
		setIsLoading(false);
	}

	const handleDelete = async () => {
		if (!editingPost) {
			return;
		}

		const confirmed = await confirm({
			title: "Brisanje objave",
			body: "Da li ste sigurni da želite izbrisati ovu objavu?",
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
			window.location.reload();
			toast.success("Objava je uspješno izbrisana");
		} catch (error) {
			toast.error("Greška pri brisanju objave");
		}
		setIsLoading(false);
	};

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">
					{editingPost ? "Izmjena objave" : "Nova objava"}
				</h1>
				{editingPost && (
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={isLoading}
					>
						Izbriši
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
								<FormLabel>Naslov</FormLabel>
								<FormControl>
									<Input placeholder="Nova objava..." {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="content"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Sadržaj</FormLabel>
								<FormControl>
									<Editor
										editable
										initialValue={editorContent}
										onChange={handleEditorChange}
									/>
								</FormControl>
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="images"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Slike</FormLabel>
								<FormControl>
									<Input type="file" multiple {...field} />
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
								<FormLabel>Javna objava</FormLabel>
								<FormControl>
									<Switch
										checked={field.value}
										onCheckedChange={field.onChange}
									/>
								</FormControl>
							</FormItem>
						)}
					/>

					<Button type="submit" disabled={isLoading}>
						Sačuvaj
					</Button>
				</form>
			</Form>
		</div>
	);
}
