"use client";

import { GenericDataTable } from "@/components/generic-data-table";
import { Button } from "@/components/ui/button";
import type { Club, ClubMembership, User } from "@prisma/client";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserTableProps {
	users: (User & {
		clubMembership: (ClubMembership & {
			club: {
				name: string;
			};
		})[];
	})[];
	totalUsers: number;
	pageSize: number;
}

export function UserTable(props: UserTableProps) {
	return (
		<GenericDataTable
			data={props.users}
			totalPages={Math.ceil(props.totalUsers / props.pageSize)}
			searchPlaceholder="Pretraži korisnike..."
			tableConfig={{
				dateFormat: "d. MMMM yyyy.",
				locale: "bs",
			}}
			columns={[
				{
					key: "avatar",
					header: "Avatar",
					cellConfig: {
						variant: "custom",
						component: (_, user) => (
							<Avatar className="h-8 w-8">
								<AvatarImage src={user.image ?? undefined} alt="Avatar" />
								<AvatarFallback>
									{user.name
										.split(" ")
										.map((name) => name[0])
										.join("")}
								</AvatarFallback>
							</Avatar>
						),
					},
				},
				{
					key: "name",
					header: "Ime",
					sortable: true,
				},
				{
					key: "email",
					header: "Email",
					sortable: true,
				},
				{
					key: "callsign",
					header: "Pozivni znak",
					sortable: true,
				},
				{
					key: "banned",
					header: "Ban",
					cellConfig: {
						variant: "badge",
						valueMap: {
							false: "Aktivan",
							default: "Aktivan",
						},
						badgeVariants: {
							true: "bg-red-100 text-red-800",
							default: "bg-green-100 text-green-800",
						},
					},
				},
				{
					key: "createdAt",
					header: "Datum registracije",
					sortable: true,
				},
				{
					key: "actions",
					header: "Akcije",
					cellConfig: {
						variant: "custom",
						component: (_, user) => (
							<div className="flex gap-2">
								<Button asChild variant='secondary'>
									<Link href={`/users/${user.id}`} target="_blank">Profil</Link>
								</Button>
								<Button asChild>
									<Link href={`?userId=${user.id}`}>Akcije</Link>
								</Button>
							</div>
						),
					},
				},
			]}
		/>
	);
}
