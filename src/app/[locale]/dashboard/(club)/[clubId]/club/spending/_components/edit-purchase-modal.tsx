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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Loader } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updatePurchase, getPurchaseReceiptUploadUrl } from "./spending.action.ts";
import type { EditPurchaseFormValues } from "./spending.schema.ts";
import { editPurchaseFormSchema } from "./spending.schema.ts";
import type { ClubPurchase } from "@generated/client";
import { useTranslations } from "next-intl";
import { FileDrop } from "@/components/ui/file-drop";

export function EditPurchaseModal({ purchase }: { purchase: ClubPurchase }) {
	const [open, setOpen] = useState(false);
	const t = useTranslations("dashboard.club.spending");
	const router = useRouter();
	const [uploadedUrls, setUploadedUrls] = useState<string[]>(purchase.receiptUrls || []);
	const [isLoading, setIsLoading] = useState(false);
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

	const handleFileUpload = async (file: File): Promise<string | null> => {
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
			toast.error(`${t("errorReceipt")} ${file.name}`);
			return null;
		}
	};

	const onSubmit = async (data: EditPurchaseFormValues) => {
		setIsLoading(true);
		try {
			data.receiptUrls = uploadedUrls;

			const result = await updatePurchase(data);
			if (result?.data) {
				toast.success(t("successEdit"));
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

	return (
		<Credenza open={open} onOpenChange={setOpen}>
			<CredenzaTrigger asChild>
				<Button variant="ghost" size="icon" type="button">
					<Pencil className="h-4 w-4" />
				</Button>
			</CredenzaTrigger>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("edit")}</CredenzaTitle>
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
										<FormLabel>{t("details.description")}</FormLabel>
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
										<FormLabel>{t("details.amount")}</FormLabel>
										<FormControl>
											<Input
												type="number"
												step="0.01"
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
												className="relative bg-background p-0.5"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" className="w-full mb-2" disabled={isLoading}>
								{isLoading ? (
									<>
										<Loader className="mr-2 h-4 w-4 animate-spin" />
										{t("saving")}
									</>
								) : (
									t("saveChanges")
								)}
							</Button>
						</form>
					</Form>
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
