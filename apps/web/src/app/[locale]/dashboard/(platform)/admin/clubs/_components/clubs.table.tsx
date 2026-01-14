"use client";

import { ArrowUpRight, Settings } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ClubsSheet } from "@/app/[locale]/dashboard/(platform)/admin/clubs/_components/clubs.sheet";
import { GenericDataTable } from "@/components/generic-data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { IMAGE_SIZES } from "@/lib/image-sizes";

type AdminClub = ApiResponse<"/api/admin/clubs", "get">["clubs"][number];

interface ClubsTableProps {
	clubs: AdminClub[];
	totalClubs: number;
	pageSize: number;
}

export function ClubsTable({ clubs, totalClubs, pageSize }: ClubsTableProps) {
	const t = useExtracted();
	const [selectedClub, setSelectedClub] = useState<AdminClub | null>(null);

	return (
		<>
			<GenericDataTable
				data={clubs}
				totalPages={Math.ceil(totalClubs / pageSize)}
				searchPlaceholder={t("Search clubs...")}
				columns={[
					{
						key: "logo",
						header: "Logo",
						cellConfig: {
							variant: "custom",
							component: (_, club) =>
								club.logo ? (
									<Image
										src={club.logo}
										alt="Logo"
										width={IMAGE_SIZES.THUMBNAIL}
										height={IMAGE_SIZES.THUMBNAIL}
										className="object-contain max-h-12"
									/>
								) : (
									<div className="w-8 h-8 bg-gray-200" />
								),
						},
					},
					{
						key: "name",
						header: t("Name"),
						sortable: true,
					},
					{
						key: "location",
						header: t("Location"),
						sortable: true,
					},
					{
						key: "banned",
						header: t("Ban"),
						cellConfig: {
							variant: "badge",
							valueMap: {
								false: t("Active"),
								true: t("Banned"),
								default: t("Active"),
							},
							badgeVariants: {
								true: "bg-red-100 text-red-800",
								default: "bg-green-100 text-green-800",
							},
						},
					},
					{
						key: "createdAt",
						header: t("Founded"),
						sortable: true,
					},
					{
						key: "actions",
						header: t("Actions"),
						cellConfig: {
							variant: "custom",
							components: (club) => [
								<DropdownMenuItem key="profile" asChild>
									<Link href={`/clubs/${club.slug || club.id}`} target="_blank">
										<ArrowUpRight className="size-4 mr-2" />
										{t("Profile")}
									</Link>
								</DropdownMenuItem>,
								<DropdownMenuItem key="actions" onClick={() => setSelectedClub(club)}>
									<Settings className="size-4 mr-2" />
									{t("Actions")}
								</DropdownMenuItem>,
							],
						},
					},
				]}
			/>

			{selectedClub && <ClubsSheet selectedClub={selectedClub} onClose={() => setSelectedClub(null)} />}
		</>
	);
}
