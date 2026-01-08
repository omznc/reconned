"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import { FileUpload, type FileUploadItem } from "@/components/ui/file-upload";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ClubPurchase } from "@/lib/api/api-type-helpers";

interface EditPurchaseModalProps {
	purchase: ClubPurchase;
}

export function EditPurchaseModal({ purchase }: EditPurchaseModalProps) {
	const [open, setOpen] = useState(false);
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const t = useExtracted();

	const purchaseFormSchema = z.object({
		clubId: z.string(),
		title: z.string().min(1, t("Title is required")),
		description: z.string().optional(),
		amount: z
			.number()
			.min(0.01, t("Amount must be greater than 0"))
			.max(100000, t("Amount must be less than 100,000 KM")),
		receiptUrls: z.array(z.string()).max(3, t("Maximum 3 receipts per item")).optional(),
	});

	const editPurchaseFormSchema = purchaseFormSchema.extend({
		id: z.string(),
	});

	type EditPurchaseFormValues = z.infer<typeof editPurchaseFormSchema>;

	// Initialize file upload system for receipts
	const initialFiles: FileUploadItem[] = purchase.receiptUrls
		? purchase.receiptUrls.map((url, index) => ({
				id: `existing-${index}`,
				url,
				name: `Receipt ${index + 1}`,
				type: url.endsWith(".pdf") ? "application/pdf" : "image/jpeg",
				isExisting: true,
			}))
		: [];

	const receiptUpload = useFileUpload({
		uploadFunction: async (file: File) => {
			const { data, error } = await apiClient.POST("/api/clubs/{id}/purchases/receipts/upload-url", {
				params: {
					path: {
						id: params.clubId,
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
				throw new Error(error?.error || t("Failed to get upload URL"));
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
				throw new Error(
					t("Upload failed with status {status}", {
						status: response.status.toString(),
					}),
				);
			}

			return data.cdnUrl;
		},
		maxFiles: 3,
		initialFiles,
	});

	const form = useForm<EditPurchaseFormValues>({
		resolver: zodResolver(editPurchaseFormSchema),
		defaultValues: {
			id: purchase.id,
			clubId: params.clubId,
			title: purchase.title,
			description: purchase.description || "",
			amount: purchase.amount,
			receiptUrls: purchase.receiptUrls || [],
		},
	});

	const [isLoading, setIsLoading] = useState(false);

	const onSubmit = async (data: EditPurchaseFormValues) => {
		setIsLoading(true);
		try {
			const uploadedUrls = await receiptUpload.uploadAllFiles();
			data.receiptUrls = uploadedUrls;

			const { error } = await apiClient.PUT("/api/clubs/{id}/purchases/{purchaseId}", {
				params: {
					path: {
						id: params.clubId,
						purchaseId: data.id,
					},
				},
				body: {
					title: data.title,
					description: data.description,
					amount: data.amount,
					receiptUrls: data.receiptUrls,
				},
			});

			if (error) {
				throw new Error(error.error || t("Error while saving expense data"));
			}

			receiptUpload.markAsSaved();
			toast.success(t("Saved"));
			setOpen(false);
			router.refresh();
		} catch (error) {
			const message = error instanceof Error ? error.message : t("Error while saving expense data");
			toast.error(message);
		}
		setIsLoading(false);
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!newOpen) {
			// Reset to initial state when closing
			receiptUpload.resetToInitial();
			form.reset();
		}
		setOpen(newOpen);
	};

	return (
		<Credenza open={open} onOpenChange={handleOpenChange}>
			<CredenzaTrigger asChild>
				<button
					id={`edit-purchase-${purchase.id}`}
					type="button"
					className="hidden"
					onClick={() => setOpen(true)}
				/>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("Edut")}</CredenzaTitle>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("Title")}</FormLabel>
										<FormControl>
											<Input placeholder={t("Title")} {...field} />
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
										<FormLabel>{t("Description")}</FormLabel>
										<FormControl>
											<Textarea placeholder={t("Description")} {...field} />
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
										<FormLabel>{t("Amount (KM)")}</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
												placeholder="0.00"
												{...field}
												onChange={(e) => field.onChange(Number.parseFloat(e.target.value))}
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
										<FormLabel>{t("Receipts")}</FormLabel>
										<FormControl>
											<FileUpload
												value={receiptUpload.files}
												onChange={receiptUpload.setFiles}
												maxFiles={3}
												maxFileSize={5 * 1024 * 1024}
												accept={{
													"image/png": [".png"],
													"image/jpeg": [".jpg", ".jpeg"],
													"application/pdf": [".pdf"],
												}}
												multiple={true}
												showPreview={true}
											/>
										</FormControl>
										<FormDescription>{t("Maximum 3 receipts per item")}</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<LoaderSubmitButton isLoading={isLoading} className="w-full">
								{isLoading ? t("Saving...") : t("Save")}
							</LoaderSubmitButton>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
