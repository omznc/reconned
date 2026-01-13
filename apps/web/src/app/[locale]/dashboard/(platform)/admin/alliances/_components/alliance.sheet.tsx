"use client";

import { format } from "date-fns";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
import {
	Credenza,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminAlliance = ApiResponse<"/api/admin/alliances/{id}", "get">["alliance"];

interface AllianceSheetProps {
	selectedAlliance?: AdminAlliance;
}

export function AllianceSheet({ selectedAlliance }: AllianceSheetProps) {
	const t = useExtracted();
	const [, setAllianceId] = useQueryState("allianceId", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});

	const handleClose = () => {
		setAllianceId(null);
	};

	const isOpen = !!selectedAlliance;

	return (
		<Credenza open={isOpen} onOpenChange={handleClose}>
			<CredenzaContent className="max-w-2xl">
				{selectedAlliance && (
					<>
						<CredenzaHeader>
							<CredenzaTitle>{selectedAlliance.name}</CredenzaTitle>
							<CredenzaDescription>
								<Badge variant="outline" className="mt-2">
									{selectedAlliance.country.iso2} - {selectedAlliance.country.name}
								</Badge>
							</CredenzaDescription>
						</CredenzaHeader>

						<div className="space-y-6 py-4">
							<div>
								<h3 className="text-sm font-medium mb-2">{t("Description")}</h3>
								<p className="text-sm text-muted-foreground">
									{selectedAlliance.description || t("No description provided")}
								</p>
							</div>

							<div>
								<h3 className="text-sm font-medium mb-2">{t("Member Clubs")}</h3>
								{selectedAlliance.clubAlliances && selectedAlliance.clubAlliances.length > 0 ? (
									<div className="space-y-2">
										{selectedAlliance.clubAlliances.map((clubAlliance) => (
											<div
												key={clubAlliance.club.id}
												className="flex items-center justify-between p-2 rounded-md border"
											>
												<div>
													<p className="font-medium">{clubAlliance.club.name}</p>
													{clubAlliance.club.location && (
														<p className="text-sm text-muted-foreground">
															{clubAlliance.club.location}
														</p>
													)}
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">{t("No clubs in this alliance")}</p>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4 pt-4 border-t">
								<div>
									<h3 className="text-sm font-medium mb-1">{t("Created")}</h3>
									<p className="text-sm text-muted-foreground">
										{format(new Date(selectedAlliance.createdAt), "PPP")}
									</p>
								</div>
								<div>
									<h3 className="text-sm font-medium mb-1">{t("Last Updated")}</h3>
									<p className="text-sm text-muted-foreground">
										{format(new Date(selectedAlliance.updatedAt), "PPP")}
									</p>
								</div>
							</div>
						</div>
					</>
				)}
			</CredenzaContent>
		</Credenza>
	);
}
