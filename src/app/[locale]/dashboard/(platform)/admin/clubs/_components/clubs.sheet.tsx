"use client";

import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { format } from "date-fns";
import { useRouter } from "@/i18n/navigation";
import type { Club } from "@prisma/client";
import { ClubActions } from "@/app/[locale]/dashboard/(platform)/admin/clubs/_components/club-table-actions";

interface ClubsSheetProps {
	selectedClub?: Club;
}

export function ClubsSheet({ selectedClub }: ClubsSheetProps) {
	const router = useRouter();

	return (
		<Credenza open={Boolean(selectedClub)} onOpenChange={() => router.push("?")}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{selectedClub?.name ?? "Ne postoji"}</CredenzaTitle>
					<CredenzaDescription>{selectedClub?.location ?? "Lokacija nije dostupna"}</CredenzaDescription>
				</CredenzaHeader>
				{!selectedClub && (
					<div className="mt-4 space-y-4">
						<p>Klub nije pronađen.</p>
					</div>
				)}
				{selectedClub && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2 text-sm">
							<div>
								<span className="text-muted-foreground">Osnovan: </span>
								{format(new Date(selectedClub.createdAt), "d. MMMM yyyy.")}
							</div>
							{selectedClub.banned && (
								<span className="text-red-600">
									Banovan do{" "}
									{selectedClub.banExpires
										? format(new Date(selectedClub.banExpires), "d. MMMM yyyy.")
										: "N/A"}
								</span>
							)}
						</div>
						<ClubActions club={selectedClub} />
					</div>
				)}
			</CredenzaContent>
		</Credenza>
	);
}
