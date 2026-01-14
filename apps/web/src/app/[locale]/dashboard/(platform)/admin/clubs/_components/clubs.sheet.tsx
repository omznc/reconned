"use client";

import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { ClubActions } from "@/app/[locale]/dashboard/(platform)/admin/clubs/_components/club-table-actions";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminClub = ApiResponse<"/api/admin/clubs", "get">["clubs"][number];

interface ClubsSheetProps {
	selectedClub?: AdminClub;
	onClose?: () => void;
}

export function ClubsSheet({ selectedClub, onClose }: ClubsSheetProps) {
	const t = useExtracted();

	return (
		<Credenza open={Boolean(selectedClub)} onOpenChange={() => onClose?.()}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{selectedClub?.name || t("Does not exist")}</CredenzaTitle>
					<CredenzaDescription>{selectedClub?.location || t("Location not available")}</CredenzaDescription>
				</CredenzaHeader>
				<CredenzaBody>
					{!selectedClub && <p>{t("Club not found.")}</p>}
					{selectedClub && (
						<div className="space-y-4">
							<div className="space-y-2 text-sm">
								<div>
									<span className="text-muted-foreground">{t("Founded:")}</span>{" "}
									{format(new Date(selectedClub.createdAt), "d. MMMM yyyy.")}
								</div>
								{selectedClub.banned && (
									<span className="text-red-600">
										{t("Banned until")}{" "}
										{selectedClub.banExpires
											? format(new Date(selectedClub.banExpires), "d. MMMM yyyy.")
											: t("N/A")}
									</span>
								)}
							</div>
							<ClubActions club={selectedClub} />
						</div>
					)}
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
