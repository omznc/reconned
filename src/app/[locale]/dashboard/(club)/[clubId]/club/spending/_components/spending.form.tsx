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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createPurchase, getPurchaseReceiptUploadUrl } from "./spending.action.ts";
import type { PurchaseFormValues } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { purchaseFormSchema } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/spending.schema";
import { LoaderSubmitButton } from "@/components/loader-submit-button";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { FileDrop } from "@/components/ui/file-drop";

export function AddPurchaseModal() {
	const [open, setOpen] = useState(false);
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const t = useTranslations("dashboard.club.spending");

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
	const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const uploadFile = async (file: File, retryCount = 0): Promise<string | null> => {
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
			if (retryCount < 3 && (error as any).message.includes("503")) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * (retryCount + 1)));
				return uploadFile(file, retryCount + 1);
			}
			throw error;
		}
	};

	const handleFileUpload = async (file: File): Promise<string | null> => {
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
			toast.error(`${t("errorReceipt")} ${file.name}`);
			return null;
		}
	};

	const onSubmit = async (data: PurchaseFormValues) => {
		setIsLoading(true);
		try {
			data.receiptUrls = uploadedUrls;
			const result = await createPurchase(data);
			if (result?.data?.purchase) {
				toast.success(t("success"));
				setOpen(false);
				setUploadedUrls([]);
				form.reset();
				router.refresh();
			}
		} catch (error) {
			toast.error(t("error"));
		}
		setIsLoading(false);
	};

	const remainingFileSlots = 3 - uploadedUrls.length;
	const canAddMoreFiles = remainingFileSlots > 0;

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button>
					<Plus className="mr-2 h-4 w-4" />
					{t("newItem")}
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("newItem")}</CredenzaTitle>
				</CredenzaHeader>
				<CredenzaBody>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("details.title")}</FormLabel>
										<FormControl>
											<Input placeholder={t("details.title")} {...field} />
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
										<FormLabel>{t("details.description")}</FormLabel>
										<FormControl>
											<Textarea placeholder={t("details.description")} {...field} />
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
										<FormLabel>{t("details.amount")}</FormLabel>
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
										<FormLabel>
											{t("details.receipts")} ({uploadedUrls.length}/3)
											{!canAddMoreFiles && (
												<span className="text-destructive ml-2 text-sm">
													{t("details.receiptsLimit")}
												</span>
											)}
										</FormLabel>
										<FormControl>
											<FileDrop
												uploadedUrls={uploadedUrls}
												onUrlsChange={setUploadedUrls}
												onUpload={handleFileUpload}
												maxFiles={3}
												maxFileSize={1024 * 1024 * 5}
												acceptedTypes={{
													"image/png": [".png"],
													"image/jpeg": [".jpg", ".jpeg"],
													"application/pdf": [".pdf"],
												}}
												disabled={!canAddMoreFiles}
												className="relative bg-background p-0.5"
											/>
										</FormControl>
										<FormDescription>{t("details.receiptsMaxCount")}</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<LoaderSubmitButton isLoading={isLoading} className="w-full">
								{isLoading ? t("saving") : t("save")}
							</LoaderSubmitButton>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
