"use client";

import { ExternalLink, Pencil, Settings } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { GenericDataTable } from "@/components/generic-data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api";
import { IMAGE_SIZES } from "@/lib/image-sizes";

type AdminUnclaimedList = ApiResponse<"/api/admin/unclaimed-clubs", "get">;
type AdminUnclaimed = AdminUnclaimedList["clubs"][number];

interface UnclaimedClubsTableProps {
	clubs: AdminUnclaimed[];
	totalClubs: number;
	pageSize: number;
}

export function UnclaimedClubsTable({ clubs, totalClubs, pageSize }: UnclaimedClubsTableProps) {
	const t = useExtracted();

	const getActionUrl = (clubId: string) => {
		return `?clubId=${clubId}`;
	};

	const getEditUrl = (clubId: string) => {
		return `/dashboard/admin/unclaimed-clubs/edit?clubId=${clubId}`;
	};

	return (
		<GenericDataTable
			data={clubs}
			totalPages={Math.ceil(totalClubs / pageSize)}
			searchPlaceholder={t("Search for clubs...")}
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
					header: "Ime",
					sortable: true,
				},
				{
					key: "location",
					header: "Lokacija",
					sortable: true,
				},
				{
					key: "_count.members",
					header: "Članovi",
					cellConfig: {
						variant: "custom",
						component: (_, club) => club._count.members,
					},
				},
				{
					key: "createdAt",
					header: "Datum kreiranja",
					sortable: true,
				},
				{
					key: "actions",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						components: (club) => [
							<DropdownMenuItem key="profile" asChild>
								<Link href={`/clubs/${club.slug ?? club.id}`} target="_blank">
									<ExternalLink className="size-4 mr-2" />
									Profil
								</Link>
							</DropdownMenuItem>,
							<DropdownMenuItem key="edit" asChild>
								<Link href={getEditUrl(club.id)}>
									<Pencil className="size-4 mr-2" />
									{t("Edit")}
								</Link>
							</DropdownMenuItem>,
							<DropdownMenuItem key="actions" asChild>
								<Link href={getActionUrl(club.id)}>
									<Settings className="size-4 mr-2" />
									Akcije
								</Link>
							</DropdownMenuItem>,
						],
					},
				},
			]}
		/>
	);
}
