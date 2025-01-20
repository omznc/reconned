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
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, CloudUpload } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createPurchase, getPurchaseReceiptUploadUrl } from "./spending.action";
import type { PurchaseFormValues } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { purchaseFormSchema } from "@/app/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import {
	FileUploader,
	FileInput,
	FileUploaderContent,
	FileUploaderItem,
} from "@/components/ui/file-upload";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { cn } from "@/lib/utils";

interface FileUploadProgress {
	file: File;
	progress: number;
	status: "pending" | "uploading" | "error" | "success";
	retries: number;
}

export function AddPurchaseModal() {
	const [open, setOpen] = useState(false);
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const form = useForm<PurchaseFormValues>({
		resolver: zodResolver(purchaseFormSchema),
		defaultValues: {
			clubId: params.clubId,
			title: "",
			description: "",
			amount: 0,
			receiptUrls: [],
		},
	});
	const [files, setFiles] = useState<File[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isUploadingFiles, setIsUploadingFiles] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>(
		[],
	);
	const MAX_RETRIES = 3;

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
				clubId: params.clubId,
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

	const onSubmit = async (data: PurchaseFormValues) => {
		setIsLoading(true);
		try {
			if (files?.length > 0) {
				setIsUploadingFiles(true);
				const uploadedUrls: string[] = [];
				setUploadProgress(
					files.map((file) => ({
						file,
						progress: 0,
						status: "pending",
						retries: 0,
					})),
				);

				for (const [index, file] of files.entries()) {
					try {
						setUploadProgress((prev) =>
							prev.map((p, i) =>
								i === index ? { ...p, status: "uploading" } : p,
							),
						);

						const cdnUrl = await uploadFile(file);
						if (cdnUrl) {
							uploadedUrls.push(cdnUrl);
							setUploadProgress((prev) =>
								prev.map((p, i) =>
									i === index ? { ...p, progress: 100, status: "success" } : p,
								),
							);
						}
					} catch (error) {
						setUploadProgress((prev) =>
							prev.map((p, i) => (i === index ? { ...p, status: "error" } : p)),
						);
						toast.error(`Greška prilikom dodavanja fajla ${file.name}`);
						throw error;
					}
				}

				data.receiptUrls = uploadedUrls;
				setIsUploadingFiles(false);
			}
			const result = await createPurchase(data);
			if (result?.data?.purchase) {
				toast.success("Kupovina uspješno dodana");
				setOpen(false);
				setFiles([]);
				form.reset();
				router.refresh();
			}
		} catch (error) {
			toast.error("Greška prilikom dodavanja kupovine");
		}
		setIsLoading(false);
		setIsUploadingFiles(false);
		setUploadProgress([]);
	};

	const remainingFileSlots = 3 - files.length;
	const canAddMoreFiles = remainingFileSlots > 0;

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					Nova stavka
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>Nova stavka</CredenzaTitle>
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
											<Input placeholder="Naziv" {...field} />
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
											<Textarea placeholder="Opis" {...field} />
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
												placeholder="0.00"
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
								render={() => (
									<FormItem>
										<FormLabel>
											Računi ({files.length}/3)
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
													// Only accept files up to the limit
													setFiles(newFiles?.slice(0, 3) ?? []);
												}}
												key={`file-uploader-${files?.length}-${files?.[0]?.name}`}
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
												className={"relative bg-background p-0.5"}
											>
												{(!files || files.length === 0) && (
													<FileInput
														key={`file-input-${files?.length}-${files?.[0]?.name}`}
														id="fileInput"
														className={cn(
															"outline-dashed outline-1 outline-slate-500",
															!canAddMoreFiles &&
																"opacity-50 cursor-not-allowed pointer-events-none",
														)}
													>
														<div className="flex items-center justify-center flex-col p-8 w-full">
															<CloudUpload className="text-gray-500 w-10 h-10" />
															<p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
																{files.length >= 3 ? (
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
												<FileUploaderContent className="flex-row flex-wrap gap-2">
													{files &&
														files.length > 0 &&
														files.map((file, i) => (
															<FileUploaderItem
																className="p-2 size-fit -ml-1 bg-sidebar border"
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
																{uploadProgress[i]?.status === "uploading" && (
																	<div className="absolute bottom-0 left-0 w-full h-1 bg-gray-200">
																		<div
																			className="h-full bg-blue-500 transition-all"
																			style={{
																				width: `${uploadProgress[i].progress}%`,
																			}}
																		/>
																	</div>
																)}
																{uploadProgress[i]?.status === "error" && (
																	<div className="absolute top-0 right-0 p-1 bg-red-500 text-white text-xs">
																		Greška
																	</div>
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
										<FormMessage />
									</FormItem>
								)}
							/>
							<LoaderSubmitButton
								isLoading={isLoading || isUploadingFiles}
								className="w-full"
							>
								{isUploadingFiles
									? `Dodavanje fajlova (${uploadProgress.reduce((acc, curr) => acc + curr.progress, 0) / files.length}%)`
									: isLoading
										? "Dodavanje kupovine..."
										: "Sačuvaj"}
							</LoaderSubmitButton>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
