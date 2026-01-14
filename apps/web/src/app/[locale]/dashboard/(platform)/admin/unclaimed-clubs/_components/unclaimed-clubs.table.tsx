"use client";

import { ArrowUpRight, Pencil, Settings } from "lucide-react";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { UnclaimedClubsSheet } from "@/app/[locale]/dashboard/(platform)/admin/unclaimed-clubs/_components/unclaimed-clubs.sheet";
import { GenericDataTable } from "@/components/generic-data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
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
	const [selectedClub, setSelectedClub] = useState<AdminUnclaimed | null>(null);

	return (
		<>
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
						header: t("Name"),
						sortable: true,
					},
					{
						key: "location",
						header: t("Location"),
						sortable: true,
					},
					{
						key: "_count.members",
						header: t("Members"),
						cellConfig: {
							variant: "custom",
							component: (_, club) => club._count.members,
						},
					},
					{
						key: "createdAt",
						header: t("Creation date"),
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
								<DropdownMenuItem key="edit" asChild>
									<Link href={`/dashboard/admin/unclaimed-clubs/edit?clubId=${club.id}`}>
										<Pencil className="size-4 mr-2" />
										{t("Edit")}
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

			{selectedClub && <UnclaimedClubsSheet selectedClub={selectedClub} onClose={() => setSelectedClub(null)} />}
		</>
	);
}
