"use client";

import type { Club } from "@generated/client";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { AssignClubOwnerForm } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/assign-club-owner.form.tsx";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { useRouter } from "@/i18n/navigation";

interface UnclaimedClubsSheetProps {
	selectedClub?: Club & {
		_count: {
			members: number;
		};
	};
}

export function UnclaimedClubsSheet({ selectedClub }: UnclaimedClubsSheetProps) {
	const router = useRouter();
	const t = useTranslations();

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
						<p>{t("dashboard.admin.unclaimedClubs.notFound")}</p>
					</div>
				)}
				{selectedClub && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2 text-sm">
							<div>
								<span className="text-muted-foreground">
									{t("dashboard.admin.unclaimedClubs.createdAt")}:{" "}
								</span>
								{format(new Date(selectedClub.createdAt), "d. MMMM yyyy.")}
							</div>
							<div>
								<span className="text-muted-foreground">
									{t("dashboard.admin.unclaimedClubs.members")}:{" "}
								</span>
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
