"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Pencil, Trash } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import apiClient from "@/lib/api/api.client";
import type { ClubRule } from "@/lib/api/api-type-helpers";
import "@/components/editor/editor.css";
import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import sanitizeHtml from "sanitize-html";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// The Tiptap editor is a large bundle and is only needed once this form is opened,
// so load it on demand instead of shipping it with the initial page chunk.
const Editor = dynamic(() => import("@/components/editor/editor").then((mod) => mod.Editor), {
	ssr: false,
	loading: () => <Skeleton className="h-64 w-full rounded-md" />,
});

interface RulesFormProps {
	rules: ClubRule[];
	clubId: string;
	editingRule: ClubRule | null;
}

export function RulesForm({ rules, clubId, editingRule }: RulesFormProps) {
	const [ruleId, setRuleId] = useQueryState("ruleId", { shallow: false });
	const [random, setRandom] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const confirm = useConfirm();
	const [selectedRule, setSelectedRule] = useState<ClubRule | null>(null);
	const [editorContent, setEditorContent] = useState<string>(editingRule?.content || "");
	const t = useExtracted();
	const router = useRouter();

	const ruleSchema = z.object({
		id: z.string().optional(),
		name: z.string().min(1, t("Name is required")).max(100, t("Name can have at most 100 characters")),
		description: z.string().optional(),
		content: z.string(),
		clubId: z.string().min(1, t("Club ID is required")),
	});

	const form = useForm<z.infer<typeof ruleSchema>>({
		resolver: zodResolver(ruleSchema),
		defaultValues: {
			id: editingRule?.id,
			name: editingRule?.name || "",
			description: editingRule?.description || "",
			clubId,
			content: editorContent,
		},
	});

	function handleEditorChange(content: string) {
		setEditorContent(content);
		form.setValue("content", content, { shouldValidate: true });
	}

	async function onSubmit(values: z.infer<typeof ruleSchema>) {
		setIsLoading(true);
		try {
			if (values.id) {
				const { error } = await apiClient.PUT("/api/clubs/{id}/rules/{ruleId}", {
					params: {
						path: {
							id: clubId,
							ruleId: values.id,
						},
					},
					body: {
						name: values.name,
						description: values.description,
						content: values.content,
					},
				});

				if (error) {
					toast.error(error.error || t("There's been a problem while saving that rule."));
					setIsLoading(false);
					return;
				}
			} else {
				const { error } = await apiClient.POST("/api/clubs/{id}/rules", {
					params: {
						path: {
							id: clubId,
						},
					},
					body: {
						name: values.name,
						description: values.description,
						content: values.content,
					},
				});

				if (error) {
					toast.error(error.error || t("There's been a problem while saving that rule."));
					setIsLoading(false);
					return;
				}
			}

			form.reset();
			setRuleId(null);
			setRandom(Math.random());
			router.refresh();
			toast.success(values.id ? t("The rulebook has been updated.") : t("The rulebook has been created"));
		} catch {
			toast.error(t("There's been a problem while saving that rule."));
		}
		setIsLoading(false);
	}

	return (
		<div className="space-y-8 w-full" key={`${random}-${ruleId}`}>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Rulebook name")}</FormLabel>
								<FormControl>
									<Input placeholder={t("My rulebook")} {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="description"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("Description (optional)")}</FormLabel>
								<FormControl>
									<Textarea placeholder={t("This rulebook is used only for...")} {...field} />
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
									<Editor onChange={handleEditorChange} initialValue={editorContent} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex gap-2 justify-start">
						<Button type="submit" className="w-full" disabled={isLoading}>
							{editingRule ? t("Save") : t("Create")}
						</Button>
						{editingRule && (
							<Button className="w-full" type="button" variant="outline" onClick={() => setRuleId(null)}>
								{t("Cancel")}
							</Button>
						)}
					</div>
				</form>
			</Form>

			<div className="space-y-4">
				<h3 className="text-lg font-semibold">{t("Existing rulebooks")}</h3>
				{rules.length === 0 && <div className="text-muted-foreground">{t("You have no rulebooks.")}</div>}
				{rules.map((rule) => (
					<Card
						key={rule.id}
						className="cursor-pointer transition-colors hover:bg-accent/50"
						onClick={() => setSelectedRule(rule)}
					>
						<CardHeader>
							<div className="flex items-start justify-between">
								<div className="space-y-2">
									<CardTitle>{rule.name}</CardTitle>
									{rule.description && (
										<p className="text-sm text-muted-foreground line-clamp-2">{rule.description}</p>
									)}
									<div className="flex items-center gap-4 text-sm text-muted-foreground">
										<div className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											<span>Kreirano {format(new Date(rule.createdAt), "dd.MM.yyyy")}</span>
										</div>
										{rule.createdAt !== rule.updatedAt && (
											<div className="flex items-center gap-1">
												<span>•</span>
												<span>Izmjenjeno {format(new Date(rule.updatedAt), "dd.MM.yyyy")}</span>
											</div>
										)}
									</div>
								</div>
								<div className="flex gap-2">
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation();
											setRuleId(rule.id);
										}}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={(e) => {
											e.stopPropagation(); // Prevent card click
											confirm({
												title: t("Delete rule"),
												body: t("Are you sure you want to delete this rulebook?"),
												actionButton: t("Confirm"),
												cancelButton: t("Cancel"),
												actionButtonVariant: "destructive",
											}).then(async (confirmed) => {
												if (confirmed) {
													try {
														const { error } = await apiClient.DELETE(
															"/api/clubs/{id}/rules/{ruleId}",
															{
																params: {
																	path: {
																		id: clubId,
																		ruleId: rule.id,
																	},
																},
															},
														);

														if (error) {
															toast.error(error.error || t("Failed to delete rulebook"));
															return;
														}

														router.refresh();
														toast.success(t("Rulebook has been deleted"));
													} catch {
														toast.error(t("Failed to delete rulebook"));
													}
												}
											});
										}}
									>
										<Trash className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="text-sm">
								{(rule.description?.length || 0) > 0
									? rule.description
									: t("This rulebook has no description")}
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<Sheet open={!!selectedRule} onOpenChange={() => setSelectedRule(null)}>
				<SheetContent side="right" className="w-screen sm:w-[45vw] overflow-y-auto flex flex-col">
					{selectedRule && (
						<>
							<SheetHeader>
								<SheetTitle>{selectedRule.name}</SheetTitle>
								<p className="text-muted-foreground">
									{(selectedRule.description?.length || 0) > 0
										? selectedRule.description
										: t("This rulebook has no description")}
								</p>
							</SheetHeader>
							<div className="mt-6 flex-1 overflow-y-auto">
								<div
									className={cn(
										"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
									)}
									// biome-ignore lint/security/noDangerouslySetInnerHtml: It's md content
									dangerouslySetInnerHTML={{
										__html: sanitizeHtml(selectedRule.content),
									}}
								/>
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
