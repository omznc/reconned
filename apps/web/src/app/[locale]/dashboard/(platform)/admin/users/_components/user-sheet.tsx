"use client";

import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { UserActions } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-table-actions";
import { Badge } from "@/components/ui/badge";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUserDetail = ApiResponse<"/api/admin/users/{id}", "get">;

type Props = {
	user?: AdminUserDetail;
};

export function UserSheet({ user }: Props) {
	const [open, setOpen] = useQueryState("userId", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const t = useExtracted();
	return (
		<Credenza open={Boolean(open)} onOpenChange={() => setOpen("")}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{user?.name ?? "Ne postoji"}</CredenzaTitle>
					<CredenzaDescription>{user?.email ?? "Korisnik ne postoji"}</CredenzaDescription>
				</CredenzaHeader>
				{!user && (
					<div className="mt-4 space-y-4">
						<p>{t("User not found.")}</p>
					</div>
				)}
				{user && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<h4 className="font-medium">Informacije</h4>
							<div className="grid gap-2 text-sm">
								{user.callsign && (
									<div>
										<span className="text-muted-foreground">Pozivni znak:</span> {user.callsign}
									</div>
								)}
								<div>
									<span className="text-muted-foreground">{t("Member since:")}</span>{" "}
									{format(new Date(user.createdAt), "d. MMMM yyyy.")}
								</div>
								{user.banned && (
									<span className="text-red-600">
										Banovan do{" "}
										{user.banExpires ? format(new Date(user.banExpires), "d. MMMM yyyy.") : "N/A"}
									</span>
								)}
							</div>
						</div>

						{user.clubMembership.length > 0 && (
							<div className="space-y-2">
								<h4 className="font-medium">Klubovi</h4>
								<div className="flex gap-1">
									{user.clubMembership.map((m) => (
										<Badge variant="outline" key={m.id}>
											{m.club?.name ?? m.clubId}
										</Badge>
									))}
								</div>
							</div>
						)}

						<UserActions user={user} />
					</div>
				)}
			</CredenzaContent>
		</Credenza>
	);
}
