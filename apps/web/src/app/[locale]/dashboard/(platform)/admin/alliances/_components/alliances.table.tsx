"use client";

import { Edit, Handshake, Plus, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminAlliance = ApiResponse<"/api/admin/alliances", "get">["alliances"][number];

interface AlliancesTableProps {
	alliances: AdminAlliance[];
	totalAlliances: number;
	pageSize: number;
}

export function AlliancesTable(props: AlliancesTableProps) {
	const t = useExtracted();
	const [, setAllianceId] = useQueryState("allianceId", { shallow: false });
	const [, setViewId] = useQueryState("viewId", { shallow: false });
	const confirm = useConfirm();
	const router = useRouter();

	const handleDelete = async (alliance: AdminAlliance) => {
		const clubCount = alliance.clubAlliances?.length || 0;
		const confirmed = await confirm({
			title: t("Delete alliance"),
			body:
				clubCount > 0
					? t(
							"This alliance has {count} club(s). Are you sure you want to delete it? This action cannot be undone.",
							{ count: clubCount.toString() },
						)
					: t("Are you sure you want to delete this alliance? This action cannot be undone."),
			cancelButton: t("Cancel"),
			actionButton: t("Delete"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		const { error } = await apiClient.DELETE("/api/admin/alliances/{id}", {
			params: { path: { id: alliance.id } },
		});

		if (error) {
			toast.error(t("Failed to delete alliance"));
			return;
		}

		toast.success(t("Alliance deleted successfully"));
		router.refresh();
	};

	return (
		<>
			<div className="flex items-center justify-between mb-4">
				<div className="text-sm text-muted-foreground">
					{t("{count} total alliances", { count: props.totalAlliances.toString() })}
				</div>
				<Button asChild>
					<Link href="?allianceId=new">
						<Plus className="mr-2 h-4 w-4" />
						{t("Create Alliance")}
					</Link>
				</Button>
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
								<DropdownMenuItem key="view" onClick={() => setViewId(alliance.id.toString())}>
									<Handshake className="size-4 mr-2" />
									{t("View Details")}
								</DropdownMenuItem>,
								<DropdownMenuItem key="edit" onClick={() => setAllianceId(alliance.id.toString())}>
									<Edit className="size-4 mr-2" />
									{t("Edit")}
								</DropdownMenuItem>,
								<DropdownMenuItem
									key="delete"
									onClick={() => handleDelete(alliance)}
									className="text-red-600"
								>
									<Trash className="size-4 mr-2" />
									{t("Delete")}
								</DropdownMenuItem>,
							],
						},
					},
				]}
			/>
		</>
	);
}
