"use client";

import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { AssignClubOwnerForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/assign-club-owner.form.tsx";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUnclaimedList = ApiResponse<"/api/admin/unclaimed-clubs", "get">;
type AdminUnclaimed = AdminUnclaimedList["clubs"][number];

interface UnclaimedClubsSheetProps {
	selectedClub?: AdminUnclaimed;
	onClose?: () => void;
}

export function UnclaimedClubsSheet({ selectedClub, onClose }: UnclaimedClubsSheetProps) {
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
									<span className="text-muted-foreground">{t("Created at")}: </span>
									{format(new Date(selectedClub.createdAt), "d. MMMM yyyy.")}
								</div>
								<div>
									<span className="text-muted-foreground">{t("Members")}: </span>
									{selectedClub._count.members}
								</div>
							</div>
							<AssignClubOwnerForm clubId={selectedClub.id} />
						</div>
					)}
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
