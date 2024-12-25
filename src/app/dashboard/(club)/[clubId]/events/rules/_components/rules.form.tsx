"use client";

import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/editor";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Trash, Calendar, Pencil } from "lucide-react";
import { ruleSchema } from "@/app/dashboard/(club)/[clubId]/events/rules/_components/rules.schema";
import {
	deleteRule,
	saveRule,
} from "@/app/dashboard/(club)/[clubId]/events/rules/_components/rules.action";
import "@/components/editor/editor.css";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { format } from "date-fns";
import { useQueryState } from "nuqs";
import { cn } from "@/lib/utils";

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
	const [editorContent, setEditorContent] = useState<string>(
		editingRule?.content ?? "",
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

	function handleEditorChange(content: string) {
		setEditorContent(content);
		form.setValue("content", content, { shouldValidate: true });
	}

	// TODO: Reset editor on form reset
	async function onSubmit(values: z.infer<typeof ruleSchema>) {
		setIsLoading(true);
		try {
			await saveRule(values);
			form.reset();
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
						render={() => (
							<FormItem>
								<FormLabel>Sadržaj</FormLabel>
								<FormControl>
									<Editor
										onChange={handleEditorChange}
										initialValue={editorContent}
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex gap-2 justify-start">
						<Button type="submit" className="w-full" disabled={isLoading}>
							{editingRule ? "Sačuvaj izmjene" : "Sačuvaj pravilnik"}
						</Button>
						{editingRule && (
							<Button
								className="w-full"
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
								{(rule.description?.length ?? 0) > 0
									? rule.description
									: "Bez opisa"}
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
								<p className="text-muted-foreground">
									{(selectedRule.description?.length ?? 0) > 0
										? selectedRule.description
										: "Bez opisa"}
								</p>
							</SheetHeader>
							<div className="mt-6 flex-1 overflow-y-auto">
								<div
									className={cn(
										"prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:p-0",
									)}
									// biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
									dangerouslySetInnerHTML={{ __html: selectedRule.content }}
								/>
							</div>
						</>
					)}
				</SheetContent>
			</Sheet>
		</div>
	);
}
