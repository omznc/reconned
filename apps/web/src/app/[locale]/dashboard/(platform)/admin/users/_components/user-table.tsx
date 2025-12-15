"use client";

import { Settings, UserCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api";

type AdminUser = ApiResponse<"/api/admin/users", "get">["users"][number];

interface UserTableProps {
	users: AdminUser[];
	totalUsers: number;
	pageSize: number;
}

export function UserTable(props: UserTableProps) {
	const searchParams = useSearchParams();

	const getActionUrl = (userId: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("userId", userId);
		return `?${params.toString()}`;
	};

	return (
		<GenericDataTable
			data={props.users}
			totalPages={Math.ceil(props.totalUsers / props.pageSize)}
			searchPlaceholder="Pretraži korisnike..."
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
						components: (user) => [
							<DropdownMenuItem key="profile" asChild>
								<Link href={`/users/${user.slug ?? user.id}`} target="_blank">
									<UserCircle className="size-4 mr-2" />
									Profil
								</Link>
							</DropdownMenuItem>,
							<DropdownMenuItem key="actions" asChild>
								<Link href={getActionUrl(user.id)}>
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
