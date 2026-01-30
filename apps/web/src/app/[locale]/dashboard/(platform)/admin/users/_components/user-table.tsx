"use client";

import { Settings, UserCircle } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { UserSheet } from "@/app/[locale]/dashboard/(platform)/admin/users/_components/user-sheet";
import { GenericDataTable } from "@/components/generic-data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminUser = ApiResponse<"/api/admin/users", "get">["users"][number];

interface UserTableProps {
	users: AdminUser[];
	totalUsers: number;
	pageSize: number;
}

export function UserTable(props: UserTableProps) {
	const t = useExtracted();
	const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

	return (
		<>
			<GenericDataTable
				data={props.users}
				totalPages={Math.ceil(props.totalUsers / props.pageSize)}
				searchPlaceholder={t("Search users...")}
				columns={[
					{
						key: "avatar",
						header: "Avatar",
						cellConfig: {
							variant: "custom",
							component: (_, user) => (
								<Avatar className="h-8 w-8">
									<AvatarImage src={user.image || undefined} alt="Avatar" />
									<AvatarFallback name={user.name} />
								</Avatar>
							),
						},
					},
					{
						key: "name",
						header: t("Name"),
						sortable: true,
					},
					{
						key: "email",
						header: t("Email"),
						sortable: true,
					},
					{
						key: "callsign",
						header: t("Callsign"),
						sortable: true,
					},
					{
						key: "banned",
						header: t("Ban"),
						cellConfig: {
							variant: "badge",
							valueMap: {
								false: t("Active"),
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
						header: t("Registration date"),
						sortable: true,
					},
					{
						key: "actions",
						header: t("Actions"),
						cellConfig: {
							variant: "custom",
							components: (user) => [
								<DropdownMenuItem key="profile" asChild>
									<Link href={`/users/${user.slug || user.id}`} target="_blank">
										<UserCircle className="size-4 mr-2" />
										{t("Profile")}
									</Link>
								</DropdownMenuItem>,
								<DropdownMenuItem key="actions" onClick={() => setSelectedUser(user)}>
									<Settings className="size-4 mr-2" />
									{t("Actions")}
								</DropdownMenuItem>,
							],
						},
					},
				]}
			/>

			{selectedUser && <UserSheet user={selectedUser} onClose={() => setSelectedUser(null)} />}
		</>
	);
}
