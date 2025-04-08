"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import type { Club } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

interface ClubsTableProps {
	clubs: Club[];
	totalClubs: number;
	pageSize: number;
}

export function ClubsTable({ clubs, totalClubs, pageSize }: ClubsTableProps) {
	const searchParams = useSearchParams();

	const getActionUrl = (clubId: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("clubId", clubId);
		return `?${params.toString()}`;
	};

	return (
		<GenericDataTable
			data={clubs}
			totalPages={Math.ceil(totalClubs / pageSize)}
			searchPlaceholder="Pretraži klubove..."
			columns={[
				{
					key: "logo",
					header: "Logo",
					cellConfig: {
						variant: "custom",
						component: (_, club) =>
							club.logo ? (
								<Image src={club.logo} alt="Logo" width={32} height={32} />
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
					key: "banned",
					header: "Ban",
					cellConfig: {
						variant: "badge",
						valueMap: { false: "Aktivan", true: "Banovan", default: "Aktivan" },
						badgeVariants: {
							true: "bg-red-100 text-red-800",
							default: "bg-green-100 text-green-800",
						},
					},
				},
				{
					key: "createdAt",
					header: "Datum osnivanja",
					sortable: true,
				},
				{
					key: "actions",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, club) => (
							<div className="flex gap-2">
								<Button asChild variant="secondary" size="sm">
									<Link href={`/clubs/${club.slug ?? club.id}`} target="_blank">
										Profil
									</Link>
								</Button>
								<Button asChild size="sm">
									<Link href={getActionUrl(club.id)}>Akcije</Link>
								</Button>
							</div>
						),
					},
				},
			]}
		/>
	);
}
