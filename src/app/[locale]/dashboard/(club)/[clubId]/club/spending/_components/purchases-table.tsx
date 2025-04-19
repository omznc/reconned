"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Trash2 } from "lucide-react";
import { deletePurchase } from "./spending.action";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { EditPurchaseModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/edit-purchase-modal";
import { Button } from "@/components/ui/button";
import type { ClubPurchase } from "@prisma/client";
import { useState } from "react";
import { FilePreviewModal } from "@/app/[locale]/dashboard/(club)/[clubId]/club/spending/_components/file-preview-modal";
import { useTranslations } from "next-intl";

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
					// {
					// 	key: "receiptUrls",
					// 	header: t("details.receipts"),
					// 	sortable: false,
					// 	cellConfig: {
					// 		variant: "custom",
					// 		component: (value: string[], row) => (
					// 			<div className="flex gap-2" key={JSON.stringify(row)}>
					// 				{value?.map((url, index) => {
					// 					const fileName = `${t("receipt.title")} ${index + 1}`;

					// 					return (
					// 						<Button
					// 							key={url}
					// 							variant="outline"
					// 							size="sm"
					// 							onClick={() => setSelectedFile({ url, name: fileName })}
					// 						>
					// 							<FileText className="h-4 w-4 mr-2" />
					// 							{fileName}
					// 						</Button>
					// 					);
					// 				})}
					// 			</div>
					// 		),
					// 	},
					// },
					{
						key: "actions",
						header: t("details.actions"),
						sortable: false,
						cellConfig: {
							variant: "custom",
							component: (_, row) => (
								<div className="flex gap-2">
									<EditPurchaseModal key={JSON.stringify(row)} purchase={row} />
									<Button
										variant="ghost"
										type="button"
										size="icon"
										onClick={async () => {
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
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							),
						},
					},
				]}
				totalPages={Math.ceil(props.totalPurchases / props.pageSize)}
				searchPlaceholder={t("search")}
			/>

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
