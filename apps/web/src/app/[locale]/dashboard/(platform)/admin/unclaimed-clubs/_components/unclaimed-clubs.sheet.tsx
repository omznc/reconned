"use client";

import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { AssignClubOwnerForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/assign-club-owner.form.tsx";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { useRouter } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUnclaimedList = ApiResponse<"/api/admin/unclaimed-clubs", "get">;
type AdminUnclaimed = AdminUnclaimedList["clubs"][number];

interface UnclaimedClubsSheetProps {
	selectedClub?: AdminUnclaimed;
}

export function UnclaimedClubsSheet({ selectedClub }: UnclaimedClubsSheetProps) {
	const router = useRouter();
	const t = useExtracted();

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			router.push("?");
		}
	};

	return (
		<Credenza open={Boolean(selectedClub)} onOpenChange={handleOpenChange}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{selectedClub?.name ?? "Ne postoji"}</CredenzaTitle>
					<CredenzaDescription>{selectedClub?.location ?? "Lokacija nije dostupna"}</CredenzaDescription>
				</CredenzaHeader>
				{!selectedClub && (
					<div className="mt-4 space-y-4">
						<p>{t("Club not found.")}</p>
					</div>
				)}
				{selectedClub && (
					<div className="mt-4 space-y-4">
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
			</CredenzaContent>
		</Credenza>
	);
}
