"use client";

import { Edit, Trash } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExtracted } from "next-intl";
import { GenericDataTable } from "@/components/generic-data-table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type FeatureFlag = ApiResponse<"/api/admin/feature-flags", "get">["featureFlags"][number];

interface FeatureFlagTableProps {
	featureFlags: FeatureFlag[];
	totalFlags: number;
	pageSize: number;
}

export function FeatureFlagTable(props: FeatureFlagTableProps) {
	const t = useExtracted();
	const searchParams = useSearchParams();

	const getEditUrl = (flagId: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("flagId", flagId);
		params.set("mode", "edit");
		return `?${params.toString()}`;
	};

	const getDeleteUrl = (flagId: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("flagId", flagId);
		params.set("mode", "delete");
		return `?${params.toString()}`;
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
							<DropdownMenuItem key="edit" asChild>
								<Link href={getEditUrl(flag.id)}>
									<Edit className="size-4 mr-2" />
									{t("Edit")}
								</Link>
							</DropdownMenuItem>,
							<DropdownMenuItem key="delete" asChild>
								<Link href={getDeleteUrl(flag.id)} className="text-red-600">
									<Trash className="size-4 mr-2" />
									{t("Delete")}
								</Link>
							</DropdownMenuItem>,
						],
					},
				},
			]}
		/>
	);
}
