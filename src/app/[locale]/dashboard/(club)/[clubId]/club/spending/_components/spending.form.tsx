"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { PurchaseFormValues } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { purchaseFormSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import { FileUpload } from "@/components/ui/file-upload.tsx";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRouter } from "@/i18n/navigation";
import { createPurchase, getPurchaseReceiptUploadUrl } from "./spending.action.ts";

export function AddPurchaseModal() {
	const [open, setOpen] = useState(false);
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const t = useExtracted();

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
				throw new ActionError("Failed to get upload URL");
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
				throw new ActionError(`Upload failed with status ${response.status}`);
			}

			return resp.data.cdnUrl;
		},
		maxFiles: 3,
	});

	const [isLoading, setIsLoading] = useState(false);

	const onSubmit = async (data: PurchaseFormValues) => {
		setIsLoading(true);
		try {
			// Upload files first
			const uploadedUrls = await receiptUpload.uploadAllFiles();
			data.receiptUrls = uploadedUrls;

			const result = await createPurchase(data);
			if (result?.data?.purchase) {
				toast.success(t("Expense successfully added"));
				setOpen(false);
				receiptUpload.resetToInitial();
				form.reset();
				router.refresh();
			}
		} catch {
			toast.error(t("Error while saving expense data"));
		}
		setIsLoading(false);
	};

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					{t("New item")}
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("New item")}</CredenzaTitle>
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
