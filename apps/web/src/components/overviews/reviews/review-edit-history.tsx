"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { History } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
	CredenzaTrigger,
} from "@/components/ui/credenza";
import apiClient from "@/lib/api/api.client";

interface ReviewEditHistoryProps {
	reviewId: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}

export function ReviewEditHistory({ reviewId, open: controlledOpen, onOpenChange }: ReviewEditHistoryProps) {
	const t = useExtracted();
	const [internalOpen, setInternalOpen] = useState(false);

	const isControlled = controlledOpen !== undefined;
	const isOpen = isControlled ? controlledOpen : internalOpen;

	const handleOpenChange = (newOpen: boolean) => {
		if (isControlled) {
			onOpenChange?.(newOpen);
		} else {
			setInternalOpen(newOpen);
		}
	};

	const { data, isLoading, refetch } = useQuery({
		queryKey: ["review-history", reviewId],
		queryFn: async () => {
			const { data } = await apiClient.GET("/api/reviews/{id}/history", {
				params: { path: { id: reviewId } },
			});
			return data;
		},
		enabled: isOpen,
	});

	const history = data?.history || [];

	return (
		<Credenza open={isOpen} onOpenChange={handleOpenChange}>
			{!isControlled && (
				<CredenzaTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="h-8 px-2 text-xs"
						onClick={() => {
							setInternalOpen(true);
							setTimeout(() => refetch(), 0);
						}}
					>
						<History className="size-3 mr-1" />
						{t("History")}
					</Button>
				</CredenzaTrigger>
			)}
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{t("Review Edit History")}</CredenzaTitle>
					<CredenzaDescription>
						{history.length} {history.length === 1 ? t("edit") : t("edits")}
					</CredenzaDescription>
				</CredenzaHeader>
				<CredenzaBody>
					{isLoading ? (
						<div className="flex justify-center py-8">
							<Loader size={24} />
						</div>
					) : history.length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-8">
							{t("No edit history available")}
						</p>
					) : (
						<div className="space-y-4">
							{history.map((entry, index) => (
								<div key={index} className="border rounded-lg p-4 space-y-2">
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>{t("Edited by {name}", { name: entry.editedBy.name })}</span>
										<span>{format(new Date(entry.createdAt), "MMM dd, yyyy HH:mm")}</span>
									</div>
									<div className="flex items-center gap-2">
										{[1, 2, 3, 4, 5].map((star) => (
											<span
												key={star}
												className={`text-sm ${
													star <= entry.previousRating
														? "text-yellow-400"
														: "text-muted-foreground"
												}`}
											>
												★
											</span>
										))}
									</div>
									<p className="text-sm text-muted-foreground">{entry.previousContent}</p>
								</div>
							))}
						</div>
					)}
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
