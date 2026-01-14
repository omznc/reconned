"use client";

import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { UserActions } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-table-actions";
import { Badge } from "@/components/ui/badge";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUser = ApiResponse<"/api/admin/users", "get">["users"][number];

type Props = {
	user?: AdminUser;
	onClose?: () => void;
};

export function UserSheet({ user, onClose }: Props) {
	const t = useExtracted();
	return (
		<Credenza open={Boolean(user)} onOpenChange={() => onClose?.()}>
			<CredenzaContent>
				<CredenzaHeader>
					<CredenzaTitle>{user?.name || t("Does not exist")}</CredenzaTitle>
					<CredenzaDescription>{user?.email || t("User does not exist")}</CredenzaDescription>
				</CredenzaHeader>
				<CredenzaBody>
					{!user && <p>{t("User not found.")}</p>}
					{user && (
						<div className="space-y-4">
							<div className="space-y-2">
								<h4 className="font-medium">{t("Information")}</h4>
								<div className="grid gap-2 text-sm">
									{user.callsign && (
										<div>
											<span className="text-muted-foreground">{t("Callsign:")}</span>{" "}
											{user.callsign}
										</div>
									)}
									<div>
										<span className="text-muted-foreground">{t("Member since:")}</span>{" "}
										{format(new Date(user.createdAt), "d. MMMM yyyy.")}
									</div>
									{user.banned && (
										<span className="text-red-600">
											{t("Banned until")}{" "}
											{user.banExpires
												? format(new Date(user.banExpires), "d. MMMM yyyy.")
												: t("N/A")}
										</span>
									)}
								</div>
							</div>

							{user.clubMembership.length > 0 && (
								<div className="space-y-2">
									<h4 className="font-medium">{t("Clubs")}</h4>
									<div className="flex gap-1">
										{user.clubMembership.map((m) => (
											<Badge variant="outline" key={m.id}>
												{m.club?.name || m.clubId}
											</Badge>
										))}
									</div>
								</div>
							)}

							<UserActions user={user} />
						</div>
					)}
				</CredenzaBody>
			</CredenzaContent>
		</Credenza>
	);
}
