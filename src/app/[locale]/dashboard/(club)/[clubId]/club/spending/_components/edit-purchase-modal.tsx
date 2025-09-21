"use client";

import type { ClubPurchase } from "@generated/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { EditPurchaseFormValues } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { editPurchaseFormSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
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
import { getPurchaseReceiptUploadUrl, updatePurchase } from "./spending.action.ts";

interface EditPurchaseModalProps {
	purchase: ClubPurchase;
}

export function EditPurchaseModal({ purchase }: EditPurchaseModalProps) {
	const [open, setOpen] = useState(false);
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const t = useTranslations();

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
			// Upload any new receipts
			const uploadedUrls = await receiptUpload.uploadAllFiles();
			data.receiptUrls = uploadedUrls;

			const result = await updatePurchase(data);
			if (result?.data?.data?.purchase) {
				receiptUpload.markAsSaved();
				toast.success(t("dashboard.club.spending.successUpdated"));
				setOpen(false);
				router.refresh();
			}
		} catch {
			toast.error(t("dashboard.club.spending.error"));
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
					<CredenzaTitle>{t("dashboard.club.spending.editItem")}</CredenzaTitle>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("dashboard.club.spending.details.title")}</FormLabel>
										<FormControl>
											<Input
												placeholder={t("dashboard.club.spending.details.title")}
												{...field}
											/>
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
										<FormLabel>{t("dashboard.club.spending.details.description")}</FormLabel>
										<FormControl>
											<Textarea
												placeholder={t("dashboard.club.spending.details.description")}
												{...field}
											/>
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
										<FormLabel>{t("dashboard.club.spending.details.amount")}</FormLabel>
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
										<FormLabel>{t("dashboard.club.spending.details.receipts")}</FormLabel>
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
										<FormDescription>
											{t("dashboard.club.spending.details.receiptsMaxCount")}
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<LoaderSubmitButton isLoading={isLoading} className="w-full">
								{isLoading ? t("common.actions.saving") : t("common.actions.save")}
							</LoaderSubmitButton>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
