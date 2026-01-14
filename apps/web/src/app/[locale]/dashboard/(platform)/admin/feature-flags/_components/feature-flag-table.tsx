"use client";

import { Edit, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { GenericDataTable } from "@/components/generic-data-table";
import { useConfirm } from "@/components/ui/alert-dialog-provider";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type FeatureFlag = ApiResponse<"/api/admin/feature-flags", "get">["featureFlags"][number];

interface FeatureFlagTableProps {
	featureFlags: FeatureFlag[];
	totalFlags: number;
	pageSize: number;
}

export function FeatureFlagTable(props: FeatureFlagTableProps) {
	const t = useExtracted();
	const [, setFlagId] = useQueryState("flagId", { shallow: false });
	const confirm = useConfirm();
	const router = useRouter();

	const handleDelete = async (flag: FeatureFlag) => {
		const confirmed = await confirm({
			title: t("Delete feature flag"),
			body: t("Are you sure you want to delete {name}? This action cannot be undone.", { name: flag.name }),
			cancelButton: t("Cancel"),
			actionButton: t("Delete"),
			actionButtonVariant: "destructive",
		});

		if (!confirmed) {
			return;
		}

		const { error } = await apiClient.DELETE("/api/admin/feature-flags/{id}", {
			params: { path: { id: flag.id } },
		});

		if (error) {
			toast.error(t("Failed to delete feature flag"));
			return;
		}

		toast.success(t("Feature flag deleted successfully"));
		router.refresh();
	};

	return (
		<GenericDataTable
			data={props.featureFlags}
			totalPages={Math.ceil(props.totalFlags / props.pageSize)}
			searchPlaceholder={t("Search feature flags...")}
			columns={[
				{
					key: "name",
					header: t("Name"),
					sortable: true,
					cellConfig: {
						variant: "custom",
						component: (_, flag) => (
							<div className="flex items-center gap-2">
								<span className="font-medium">{flag.name}</span>
							</div>
						),
					},
				},
				{
					key: "description",
					header: t("Description"),
					cellConfig: {
						variant: "custom",
						component: (_, flag) => (
							<span className="text-muted-foreground text-sm">
								{flag.description || t("No description")}
							</span>
						),
					},
				},
				{
					key: "enabled",
					header: t("Status"),
					cellConfig: {
						variant: "custom",
						component: (_, flag) => (
							<Badge variant={flag.enabled ? "default" : "secondary"}>
								{flag.enabled ? t("Enabled") : t("Disabled")}
							</Badge>
						),
					},
				},
				{
					key: "createdAt",
					header: t("Created"),
					sortable: true,
					cellConfig: {
						variant: "custom",
						component: (_, flag) => (
							<span className="text-sm text-muted-foreground">
								{new Date(flag.createdAt).toLocaleDateString()}
							</span>
						),
					},
				},
				{
					key: "actions",
					header: t("Actions"),
					cellConfig: {
						variant: "custom",
						components: (flag) => [
							<DropdownMenuItem key="edit" onClick={() => setFlagId(flag.id)}>
								<Edit className="size-4 mr-2" />
								{t("Edit")}
							</DropdownMenuItem>,
							<DropdownMenuItem key="delete" onClick={() => handleDelete(flag)} className="text-red-600">
								<Trash className="size-4 mr-2" />
								{t("Delete")}
							</DropdownMenuItem>,
						],
					},
				},
			]}
		/>
	);
}
