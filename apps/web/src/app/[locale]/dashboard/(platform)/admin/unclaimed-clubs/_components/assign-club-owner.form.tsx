"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader } from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "@/i18n/navigation";
import apiClient from "@/lib/api/api.client";
import { cn } from "@/lib/utils";

interface AssignClubOwnerFormProps {
	clubId: string;
}

export function AssignClubOwnerForm({ clubId }: AssignClubOwnerFormProps) {
	const [open, setOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<string>("");
	const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; callsign: string | null }>>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const t = useExtracted();
	const router = useRouter();

	useEffect(() => {
		if (searchQuery.length > 2) {
			fetch(`/api/admin/users?query=${encodeURIComponent(searchQuery)}&includeCurrentUser=true`)
				.then((res) => {
					if (!res.ok) {
						throw new Error("Failed to fetch users");
					}
					return res.json();
				})
				.then((data) => {
					if (Array.isArray(data)) {
						setUsers(data);
					}
				})
				.catch(() => {
					setUsers([]);
				});
		} else {
			setUsers([]);
		}
	}, [searchQuery]);

	const handleAssign = async () => {
		if (!selectedUserId) {
			toast.error(t("Select a user"));
			return;
		}

		setIsLoading(true);
		try {
			const { data, error } = await apiClient.POST("/api/admin/unclaimed-clubs/{id}/assign-owner", {
				params: {
					path: {
						id: clubId,
					},
				},
				body: {
					userId: selectedUserId,
				},
			});

			if (!error && data?.success) {
				toast.success(t("Club owner assigned successfully"));
				const params = new URLSearchParams(window.location.search);
				params.delete("clubId");
				router.replace(`?${params.toString()}`);
			} else {
				throw new Error();
			}
		} catch {
			toast.error(t("Failed to assign club owner"));
		} finally {
			setIsLoading(false);
		}
	};

	const selectedUser = users.find((u) => u.id === selectedUserId);

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="assign-club-owner-select" className="text-sm font-medium">
					{t("Assign club owner")}
				</label>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							id="assign-club-owner-select"
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between"
						>
							{selectedUser
								? `${selectedUser.name}${selectedUser.callsign ? ` (${selectedUser.callsign})` : ""}`
								: t("Select a user")}
							<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-full p-0" align="start">
						<Command shouldFilter={false}>
							<CommandInput
								placeholder={t("Search users...")}
								value={searchQuery}
								onValueChange={setSearchQuery}
							/>
							<CommandList>
								<CommandEmpty>{t("No users found.")}</CommandEmpty>
								<CommandGroup>
									{users.map((user) => (
										<CommandItem
											key={user.id}
											value={user.id}
											onSelect={() => {
												setSelectedUserId(user.id === selectedUserId ? "" : user.id);
												setOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													selectedUserId === user.id ? "opacity-100" : "opacity-0",
												)}
											/>
											{user.name}
											{user.callsign && (
												<span className="text-muted-foreground ml-2">({user.callsign})</span>
											)}
											<span className="text-muted-foreground ml-2">({user.email})</span>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>
			<Button onClick={handleAssign} disabled={isLoading || !selectedUserId}>
				{isLoading && (
					<span className="mr-2">
						<Loader size={16} />
					</span>
				)}
				{t("Assign owner")}
			</Button>
		</div>
	);
}
