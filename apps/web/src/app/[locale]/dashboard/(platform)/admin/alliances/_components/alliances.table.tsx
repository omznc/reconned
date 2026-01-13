"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { AllianceActions } from "./alliance-actions.tsx";
import { CreateAllianceDialog } from "./create-alliance.dialog.tsx";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

interface AlliancesTableProps {
	alliances: AdminAlliance[];
}

export function AlliancesTable({ alliances }: AlliancesTableProps) {
	const t = useExtracted();
	const router = useRouter();
	const [createDialogOpen, setCreateDialogOpen] = useState(false);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="text-sm text-muted-foreground" />
				<Button onClick={() => setCreateDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					{t("Create Alliance")}
				</Button>
			</div>

			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("Name")}</TableHead>
							<TableHead>{t("Country")}</TableHead>
							<TableHead>{t("Description")}</TableHead>
							<TableHead>{t("Clubs")}</TableHead>
							<TableHead className="text-right">{t("Actions")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{alliances.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-center text-muted-foreground h-24">
									{t("No alliances found")}
								</TableCell>
							</TableRow>
						) : (
							alliances.map((alliance) => (
								<TableRow
									key={alliance.id}
									className="cursor-pointer"
									onClick={() => router.push(`/dashboard/admin/alliances?allianceId=${alliance.id}`)}
								>
									<TableCell className="font-medium">{alliance.name}</TableCell>
									<TableCell>
										<Badge>
											{alliance.country.iso2} - {alliance.country.name}
										</Badge>
									</TableCell>
									<TableCell className="max-w-md truncate">
										{alliance.description || <span className="text-muted-foreground">-</span>}
									</TableCell>
									<TableCell>{alliance.clubAlliances?.length || 0}</TableCell>
									<TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
										<AllianceActions alliance={alliance} />
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<CreateAllianceDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
		</div>
	);
}
