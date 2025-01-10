"use client";

import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, CloudUpload, Loader, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	updatePurchase,
	getPurchaseReceiptUploadUrl,
	deleteReceipt,
} from "./spending.action";
import type { EditPurchaseFormValues } from "./spending.schema";
import { editPurchaseFormSchema } from "./spending.schema";
import type { ClubPurchase } from "@prisma/client";
import {
	FileUploader,
	FileInput,
	FileUploaderContent,
	FileUploaderItem,
} from "@/components/ui/file-upload";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card";
import Image from "next/image";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { cn } from "@/lib/utils";

interface FileUploadProgress {
	file: File;
	progress: number;
	status: "pending" | "uploading" | "error" | "success";
	retries: number;
}

export function EditPurchaseModal({ purchase }: { purchase: ClubPurchase }) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const confirm = useConfirm();
	const [files, setFiles] = useState<File[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);
	const [isUploadingFiles, setIsUploadingFiles] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>(
		[],
	);
	const MAX_RETRIES = 3;
	const form = useForm<EditPurchaseFormValues>({
		resolver: zodResolver(editPurchaseFormSchema),
		defaultValues: {
			id: purchase.id,
			clubId: purchase.clubId,
			title: purchase.title,
			description: purchase.description || "",
			amount: purchase.amount,
			receiptUrls: purchase.receiptUrls,
		},
	});

	const existingReceiptsCount = form.watch("receiptUrls")?.length || 0;
	const remainingFileSlots = 3 - existingReceiptsCount - files.length;
	const canAddMoreFiles = remainingFileSlots > 0;

	const uploadFile = async (
		file: File,
		retryCount = 0,
	): Promise<string | null> => {
		try {
			const resp = await getPurchaseReceiptUploadUrl({
				file: {
					type: file.type,
					size: file.size,
					name: file.name,
				},
				clubId: purchase.clubId,
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
		} catch (error) {
			if (retryCount < MAX_RETRIES && (error as any).message.includes("503")) {
				await new Promise((resolve) =>
					setTimeout(resolve, 1000 * (retryCount + 1)),
				);
				return uploadFile(file, retryCount + 1);
			}
			throw error;
		}
	};

	const onSubmit = async (data: EditPurchaseFormValues) => {
		setIsLoading(true);
		try {
			if (files.length > 0) {
				const totalReceiptsCount =
					(data.receiptUrls?.length || 0) + files.length;
				if (totalReceiptsCount > 3) {
					toast.error("Maksimalno 3 računa po stavci");
					return;
				}
				setIsUploadingFiles(true);
				const uploadedUrls: string[] = [];

				for (const [index, file] of files.entries()) {
					try {
						const resp = await getPurchaseReceiptUploadUrl({
							file: {
								type: file.type,
								size: file.size,
								name: file.name,
							},
							clubId: purchase.clubId,
						});

						if (!resp?.data?.url) {
							throw new Error("Failed to get upload URL");
						}

						await fetch(resp.data.url, {
							method: "PUT",
							body: file,
							headers: {
								"Content-Type": file.type,
								"Content-Length": file.size.toString(),
							},
						});

						uploadedUrls.push(resp.data.cdnUrl);
						setUploadProgress((prev) =>
							prev.map((p) => {
								if (p.file.name === file.name) {
									return {
										...p,
										status: "success",
									};
								}
								return p;
							}),
						);
					} catch (error) {
						toast.error(`Greška prilikom dodavanja fajla ${file.name}`);
						throw error;
					}
				}

				data.receiptUrls = [...(data.receiptUrls || []), ...uploadedUrls];
				setIsUploadingFiles(false);
			}

			const result = await updatePurchase(data);
			if (result?.data) {
				toast.success("Kupovina uspješno izmijenjena");
				setOpen(false);
				setFiles([]);
				form.reset();
				router.refresh();
			}
		} catch (error) {
			toast.error("Greška prilikom izmjene kupovine");
		}
		setIsLoading(false);
		setIsUploadingFiles(false);
		setUploadProgress([]);
	};

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button variant="ghost" size="icon" type="button">
					<Pencil className="h-4 w-4" />
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>Izmijeni kupovinu</CredenzaTitle>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Naslov</FormLabel>
										<FormControl>
											<Input {...field} />
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
										<FormLabel>Opis</FormLabel>
										<FormControl>
											<Textarea {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="amount"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Iznos (KM)</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												{...field}
												onChange={(e) =>
													field.onChange(Number.parseFloat(e.target.value))
												}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="receiptUrls"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											Računi ({(field.value?.length || 0) + files.length}/3)
											{!canAddMoreFiles && (
												<span className="text-destructive ml-2 text-sm">
													Dostigli ste limit
												</span>
											)}
										</FormLabel>
										<FormControl>
											<FileUploader
												value={files}
												onValueChange={(newFiles) => {
													// Only accept files up to the remaining limit
													const available = 3 - (field.value?.length || 0);
													setFiles(newFiles?.slice(0, available) || []);
												}}
												dropzoneOptions={{
													maxFiles: remainingFileSlots,
													maxSize: 1024 * 1024 * 5,
													accept: {
														"image/png": [".png"],
														"image/jpeg": [".jpg", ".jpeg"],
														"application/pdf": [".pdf"],
													},
													disabled: !canAddMoreFiles,
												}}
												className="relative bg-background p-0.5"
											>
												{(!files || files.length === 0) && (
													<FileInput
														key={`file-input-${files?.length}-${files?.[0]?.name}`}
														id="fileInput"
														className={cn(
															"outline-dashed outline-1 outline-slate-500",
															(field.value?.length || 0) >= 3 &&
																"opacity-50 cursor-not-allowed pointer-events-none",
														)}
													>
														<div className="flex items-center justify-center flex-col p-8 w-full">
															<CloudUpload className="text-gray-500 w-10 h-10" />
															<p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
																{(field.value?.length || 0) >= 3 ? (
																	<span>Dostigli ste limit od 3 računa</span>
																) : (
																	<>
																		<span className="font-semibold">
																			Kliknite da dodate fajl
																		</span>
																		, ili ga samo prebacite ovde
																	</>
																)}
															</p>
															<p className="text-xs text-gray-500 dark:text-gray-400">
																Dozvoljeni formati: JPG, JPEG, PNG, PDF
															</p>
														</div>
													</FileInput>
												)}
												<FileUploaderContent>
													{files &&
														files.length > 0 &&
														files.map((file, i) => (
															<FileUploaderItem
																className="p-2 size-fit -ml-1"
																key={file.name}
																index={i}
															>
																{file.type === "application/pdf" ? (
																	<div className="h-[100px] mr-4 p-2 border w-auto flex flex-col items-center justify-center">
																		<p className="text-sm">PDF Dokument</p>
																		<p className="text-sm">({file.name})</p>
																	</div>
																) : (
																	<img
																		src={URL.createObjectURL(file)}
																		alt={file.name}
																		className="h-[100px] mr-4 w-auto object-fit"
																	/>
																)}
															</FileUploaderItem>
														))}
												</FileUploaderContent>
											</FileUploader>
										</FormControl>
										<FormDescription>
											Dodajte slike ili PDF fajlove računa (max 5MB po fajlu,
											max 3 računa)
										</FormDescription>
										{field.value && field.value.length > 0 && (
											<div className="mt-4 space-y-2">
												<h3 className="font-semibold">Računi</h3>
												<p className="text-sm text-muted-foreground">
													Brisanje će ukloniti račun bez da kliknete "Sačuvaj
													izmjene"
												</p>
												<div className="flex flex-wrap gap-1">
													{field.value.map((url, index) => (
														<HoverCard key={url}>
															<div className="flex items-center p-2 bg-sidebar gap-2 border">
																<HoverCardTrigger className="text-sm cursor-pointer">
																	Račun {index + 1}
																</HoverCardTrigger>
																<Button
																	type="button"
																	variant="ghost"
																	className="h-5 p-1"
																	disabled={isDeletingReceipt}
																	onClick={async () => {
																		const confirmed = await confirm({
																			title: "Jeste li sigurni?",
																			body: "Ako obrišete račun, nećete ga moći vratiti nazad.",
																			actionButton: "Obriši",
																			cancelButton: "Otkaži",
																			actionButtonVariant: "destructive",
																		});

																		if (!confirmed) {
																			return;
																		}

																		setIsDeletingReceipt(true);
																		await deleteReceipt({
																			purchaseId: purchase.id,
																			receiptUrl: url,
																		});
																		setIsDeletingReceipt(false);

																		const newUrls = field.value?.filter(
																			(u) => u !== url,
																		);
																		form.setValue("receiptUrls", newUrls);
																		router.refresh();
																	}}
																>
																	{isDeletingReceipt ? (
																		<Loader className="h-4 w-4 animate-spin" />
																	) : (
																		<Trash className="h-4 w-4" />
																	)}
																</Button>
															</div>
															<HoverCardContent className="w-full">
																{url.endsWith(".pdf") ? (
																	<embed
																		title="Receipt"
																		src={url}
																		className="h-[300px] w-full"
																	/>
																) : (
																	<Image
																		src={url}
																		alt={`Receipt ${index + 1}`}
																		width={300}
																		height={400}
																		className="object-contain"
																	/>
																)}
															</HoverCardContent>
														</HoverCard>
													))}
												</div>
											</div>
										)}
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button
								type="submit"
								className="w-full mb-2"
								disabled={isLoading || isUploadingFiles}
							>
								{isUploadingFiles ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										Dodavanje fajlova (
										{Math.round(
											(uploadProgress.reduce((acc, p) => acc + p.progress, 0) /
												uploadProgress.length) *
												100,
										)}
										%)
									</>
								) : isLoading ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										Izmjena kupovine...
									</>
								) : (
									"Sačuvaj izmjene"
								)}
							</Button>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
