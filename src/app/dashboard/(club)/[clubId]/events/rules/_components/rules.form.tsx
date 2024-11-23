"use client";

import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import type { ClubRule } from "@prisma/client";
import {
	Form,
	FormField,
	FormItem,
	FormLabel,
	FormControl,
	FormMessage,
} from "@/components/ui/form";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Trash, Calendar, MoreVertical, Pencil } from "lucide-react";
import { ruleSchema } from "@/app/dashboard/(club)/[clubId]/events/rules/_components/rules.schema";
import {
	deleteRule,
	saveRule,
} from "@/app/dashboard/(club)/[clubId]/events/rules/_components/rules.action";
import { useEditor, type JSONContent } from "novel";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { format } from "date-fns";
import { useQueryState } from "nuqs";

interface RulesFormProps {
	rules: ClubRule[];
	clubId: string;
	editingRule: ClubRule | null;
}

export function RulesForm({ rules, clubId, editingRule }: RulesFormProps) {
	const [ruleId, setRuleId] = useQueryState("ruleId", { shallow: false });
	const [random, setRandom] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const { editor } = useEditor();
	const confirm = useConfirm();
	const [selectedRule, setSelectedRule] = useState<ClubRule | null>(null);
	const [editorContent, setEditorContent] = useState<JSONContent>(
		(editingRule?.content as JSONContent) ?? {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "Pišite ovde..." }],
				},
			],
		},
	);

	const form = useForm<z.infer<typeof ruleSchema>>({
		resolver: zodResolver(ruleSchema),
		defaultValues: {
			id: editingRule?.id,
			name: editingRule?.name ?? "",
			description: editingRule?.description ?? "",
			clubId,
			content: editorContent,
		},
	});

	function handleEditorChange(content: JSONContent) {
		setEditorContent(content);
		form.setValue("content", content, { shouldValidate: true });
	}

	// TODO: Reset editor on form reset
	async function onSubmit(values: z.infer<typeof ruleSchema>) {
		setIsLoading(true);
		try {
			// @ts-expect-error TODO: Type better
			await saveRule(values);
			form.reset();
			editor?.commands.clearContent(true);
			setRuleId(null);
			setRandom(Math.random());
			toast.success(
				values.id
					? "Pravilnik je uspješno izmijenjen"
					: "Pravilnik je uspješno sačuvan",
			);
		} catch (error) {
			toast.error("Greška pri čuvanju pravilnika");
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
								<FormLabel>Ime pravilnika</FormLabel>
								<FormControl>
									<Input placeholder="Moj pravilnik" {...field} />
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
								<FormLabel>Opis (opcionalno)</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Ovo je pravilnik za moj klub"
										{...field}
									/>
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
									<div className="h-full p-3 w-full border">
										<Editor
											onChange={handleEditorChange}
											initialValue={editorContent}
										/>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex gap-2 justify-start">
						<Button type="submit" disabled={isLoading}>
							{editingRule ? "Sačuvaj izmjene" : "Sačuvaj pravilnik"}
						</Button>
						{editingRule && (
							<Button
								type="button"
								variant="outline"
								onClick={() => setRuleId(null)}
							>
								Otkaži
							</Button>
						)}
					</div>
				</form>
			</Form>

			<div className="space-y-4">
				<h3 className="text-lg font-semibold">Postojeći pravilnici</h3>
				{rules.length === 0 && (
					<div className="text-muted-foreground">Trenutno nema pravilnika.</div>
				)}
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
										<p className="text-sm text-muted-foreground line-clamp-2">
											{rule.description}
										</p>
									)}
									<div className="flex items-center gap-4 text-sm text-muted-foreground">
										<div className="flex items-center gap-1">
											<Calendar className="h-3 w-3" />
											<span>
												Kreirano{" "}
												{format(new Date(rule.createdAt), "dd.MM.yyyy")}
											</span>
										</div>
										{rule.createdAt !== rule.updatedAt && (
											<div className="flex items-center gap-1">
												<span>•</span>
												<span>
													Izmjenjeno{" "}
													{format(new Date(rule.updatedAt), "dd.MM.yyyy")}
												</span>
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
												title: "Izbriši pravilnik",
												body: "Da li ste sigurni da želite izbrisati ovaj pravilnik?",
												actionButton: "Izbriši",
												cancelButton: "Otkaži",
												actionButtonVariant: "destructive",
											}).then((confirmed) => {
												if (confirmed) {
													deleteRule({
														ruleId: rule.id,
														clubId: rule.clubId,
													}).then(() => {
														toast.success("Pravilnik je uspješno izbrisan");
													});
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
								{/* Preview first paragraph of content */}
								{(
									(rule.content as JSONContent)?.content?.[0]?.content?.[0]
										?.text || ""
								).slice(0, 150)}
								{(
									(rule.content as JSONContent)?.content?.[0]?.content?.[0]
										?.text || ""
								).length > 150 && "..."}
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			<Sheet open={!!selectedRule} onOpenChange={() => setSelectedRule(null)}>
				<SheetContent
					side="right"
					className="w-screen sm:w-[45vw] overflow-y-auto flex flex-col"
				>
					{selectedRule && (
						<>
							<SheetHeader>
								<SheetTitle>{selectedRule.name}</SheetTitle>
								{selectedRule.description && (
									<p className="text-muted-foreground">
										{selectedRule.description}
									</p>
								)}
							</SheetHeader>
							<div className="mt-6 flex-1 overflow-y-auto">
								<Editor
									editable={false}
									initialValue={selectedRule.content as JSONContent}
									onChange={() => {}}
								/>
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
