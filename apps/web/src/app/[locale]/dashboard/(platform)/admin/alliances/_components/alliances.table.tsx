"use client";

import { Edit, Handshake, Plus, Trash } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { GenericDataTable } from "@/components/generic-data-table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

interface AlliancesTableProps {
	alliances: AdminAlliance[];
	totalAlliances: number;
	pageSize: number;
}

export function AlliancesTable(props: AlliancesTableProps) {
	const t = useExtracted();
	const searchParams = useSearchParams();

	const getViewUrl = (allianceId: number) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("allianceId", allianceId.toString());
		return `?${params.toString()}`;
	};

	const getEditUrl = (allianceId: number) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("allianceId", allianceId.toString());
		params.set("mode", "edit");
		return `?${params.toString()}`;
	};

	const getDeleteUrl = (allianceId: number) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("allianceId", allianceId.toString());
		params.set("mode", "delete");
		return `?${params.toString()}`;
	};

	return (
		<>
			<div className="flex items-center justify-between mb-4">
				<div className="text-sm text-muted-foreground">
					{t("{count} total alliances", { count: props.totalAlliances.toString() })}
				</div>
				<Link
					href="?mode=create"
					className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
				>
					<Plus className="mr-2 h-4 w-4" />
					{t("Create Alliance")}
				</Link>
			</div>
			<GenericDataTable
				data={props.alliances}
				totalPages={Math.ceil(props.totalAlliances / props.pageSize)}
				searchPlaceholder={t("Search alliances...")}
				columns={[
					{
						key: "name",
						header: t("Name"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (_, alliance) => (
								<div className="flex items-center gap-2">
									<span className="font-medium">{alliance.name}</span>
								</div>
							),
						},
					},
					{
						key: "country",
						header: t("Country"),
						cellConfig: {
							variant: "custom",
							component: (_, alliance) => (
								<Badge variant="outline">
									{alliance.country.iso2} - {alliance.country.name}
								</Badge>
							),
						},
					},
					{
						key: "description",
						header: t("Description"),
						cellConfig: {
							variant: "custom",
							component: (_, alliance) => (
								<span className="text-muted-foreground text-sm max-w-md truncate block">
									{alliance.description || t("No description")}
								</span>
							),
						},
					},
					{
						key: "clubCount",
						header: t("Clubs"),
						cellConfig: {
							variant: "custom",
							component: (_, alliance) => (
								<Badge variant="secondary">{alliance.clubAlliances?.length || 0}</Badge>
							),
						},
					},
					{
						key: "createdAt",
						header: t("Created"),
						sortable: true,
						cellConfig: {
							variant: "custom",
							component: (_, alliance) => (
								<span className="text-sm text-muted-foreground">
									{new Date(alliance.createdAt).toLocaleDateString()}
								</span>
							),
						},
					},
					{
						key: "actions",
						header: t("Actions"),
						cellConfig: {
							variant: "custom",
							components: (alliance) => [
								<DropdownMenuItem key="view" asChild>
									<Link href={getViewUrl(alliance.id)}>
										<Handshake className="size-4 mr-2" />
										{t("View Details")}
									</Link>
								</DropdownMenuItem>,
								<DropdownMenuItem key="edit" asChild>
									<Link href={getEditUrl(alliance.id)}>
										<Edit className="size-4 mr-2" />
										{t("Edit")}
									</Link>
								</DropdownMenuItem>,
								<DropdownMenuItem key="delete" asChild>
									<Link href={getDeleteUrl(alliance.id)} className="text-red-600">
										<Trash className="size-4 mr-2" />
										{t("Delete")}
									</Link>
								</DropdownMenuItem>,
							],
						},
					},
				]}
			/>
		</>
	);
}
