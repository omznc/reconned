"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Trash2, MoreHorizontal, Edit } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
										<DropdownMenuItem onSelect={(e) => {
											e.preventDefault();
											document.getElementById(`edit-purchase-${row.id}`)?.click();
										}}>
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
