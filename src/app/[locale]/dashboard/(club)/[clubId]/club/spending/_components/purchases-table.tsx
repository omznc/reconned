"use client";

import type { ClubPurchase } from "@generated/client";
import { Edit, MoreHorizontal, Trash2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { EditPurchaseModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/edit-purchase-modal";
import { FilePreviewModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/file-preview-modal";
import { GenericDataTable } from "@/components/generic-data-table";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";
import { deletePurchase } from "./spending.action.ts";

interface PurchasesTableProps {
	purchases: ClubPurchase[];
	totalPurchases: number;
	pageSize: number;
}

export function PurchasesTable(props: PurchasesTableProps) {
	const router = useRouter();
	const confirm = useConfirm();
	const t = useTranslations("dashboard.club.spending");
	const [selectedFile, setSelectedFile] = useState<{
		url: string;
		name: string;
	} | null>(null);

	return (
		<>
			<GenericDataTable
				data={props.purchases}
				columns={[
					{
						key: "title",
						header: t("details.title"),
						sortable: true,
					},
					{
						key: "description",
						header: t("details.description"),
						sortable: true,
					},
					{
						key: "amount",
						header: t("details.amount"),
						sortable: true,
						cellConfig: {
							component: (value: number) => `${value.toFixed(2)} KM`,
						},
					},
					{
						key: "receiptUrls",
						header: t("details.receipts"),
						sortable: false,
						cellConfig: {
							variant: "custom",
							component: (receiptUrls: string[], _row) => (
								<div className="flex gap-1 flex-wrap">
									{receiptUrls && receiptUrls.length > 0 ? (
										receiptUrls.map((url, index) => (
											<button
												key={`receipt-${url.split('/').pop()}-${index}`}
												type="button"
												onClick={() => {
													const isPdf = url.toLowerCase().endsWith(".pdf");
													const fileName = `Receipt ${index + 1}${isPdf ? ".pdf" : ""}`;
													setSelectedFile({ url, name: fileName });
												}}
												className="w-8 h-8 rounded border overflow-hidden hover:border-primary transition-colors"
											>
												{url.toLowerCase().endsWith(".pdf") ? (
													<div className="w-full h-full bg-red-100 flex items-center justify-center text-xs text-red-600 font-medium">
														PDF
													</div>
												) : (
													<Image
														src={url}
														alt={`Receipt ${index + 1}`}
														width={32}
														height={32}
														className="w-full h-full object-cover"
														style={{ imageRendering: "pixelated" }}
													/>
												)}
											</button>
										))
									) : (
										<span className="text-muted-foreground text-sm">-</span>
									)}
								</div>
							),
						},
					},
					{
						key: "createdAt",
						header: t("date"),
						sortable: true,
						cellConfig: {
							component: (value: Date) =>
								new Intl.DateTimeFormat("bs", {
									day: "2-digit",
									month: "2-digit",
									year: "numeric",
								}).format(new Date(value)),
						},
					},
					{
						key: "actions",
						header: t("details.actions"),
						sortable: false,
						cellConfig: {
							variant: "custom",
							component: (_, row) => (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" size="sm">
											<MoreHorizontal className="size-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onSelect={(e) => {
												e.preventDefault();
												document.getElementById(`edit-purchase-${row.id}`)?.click();
											}}
										>
											<Edit className="size-4 mr-2" />
											{t("edit")}
										</DropdownMenuItem>
										<DropdownMenuItem
											className="text-destructive focus:text-destructive"
											onSelect={async (e) => {
												e.preventDefault();
												const confirmed = await confirm({
													title: t("deleteConfirm.title"),
													body: t("deleteConfirm.body"),
													actionButton: t("deleteConfirm.action"),
													actionButtonVariant: "destructive",
													cancelButton: t("deleteConfirm.cancel"),
												});

												if (!confirmed) {
													return;
												}

												return deletePurchase({
													id: row.id,
													clubId: row.clubId,
												}).then((result) => {
													if (result?.data) {
														toast.success(t("successDelete"));
														router.refresh();
													} else {
														toast.error(t("errorDelete"));
													}
												});
											}}
										>
											<Trash2 className="size-4 mr-2" />
											{t("delete")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							),
						},
					},
				]}
				totalPages={Math.ceil(props.totalPurchases / props.pageSize)}
				searchPlaceholder={t("search")}
			/>

			<div className="hidden">
				{props.purchases.map((purchase) => (
					<EditPurchaseModal key={purchase.id} purchase={purchase} />
				))}
			</div>

			{selectedFile && (
				<FilePreviewModal
					isOpen={!!selectedFile}
					onClose={() => setSelectedFile(null)}
					fileUrl={selectedFile.url}
					fileName={selectedFile.name}
				/>
			)}
		</>
	);
}
