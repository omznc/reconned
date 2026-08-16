"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Minus, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Credenza,
	CredenzaBody,
	CredenzaContent,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@/components/ui/credenza";
import { Input } from "@/components/ui/input";
import apiClient from "@/lib/api/api.client";
import type { ApiResponse } from "@/lib/api/api-type-helpers";

type AdminAlliance = ApiResponse<"/api/admin/alliances/{id}", "get">["alliance"];

interface AllianceSheetProps {
	selectedAlliance?: AdminAlliance;
}

export function AllianceSheet({ selectedAlliance }: AllianceSheetProps) {
	const t = useExtracted();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [viewId, setViewId] = useQueryState("viewId", {
		shallow: false,
		clearOnDefault: true,
		history: "replace",
	});
	const [clubSearch, setClubSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const isOpen = Boolean(viewId && selectedAlliance);

	const debouncedSetSearch = useDebouncedCallback((value: string) => {
		setDebouncedSearch(value);
	}, 300);

	const handleSearchChange = (value: string) => {
		setClubSearch(value);
		debouncedSetSearch(value);
	};

	const { data: clubsData } = useQuery({
		queryKey: ["admin-clubs", debouncedSearch, selectedAlliance?.country?.id],
		queryFn: async () => {
			const response = await apiClient.GET("/api/admin/clubs", {
				params: {
					query: {
						page: 1,
						perPage: 50,
						...(debouncedSearch ? { search: debouncedSearch } : {}),
						...(selectedAlliance?.country?.id ? { countryId: selectedAlliance.country.id } : {}),
					},
				},
			});
			return response.data?.clubs || [];
		},
		enabled: isOpen && debouncedSearch.length >= 1,
	});

	const handleClose = () => {
		setViewId(null);
		setClubSearch("");
		setDebouncedSearch("");
	};

	const handleAddClub = async (clubId: string) => {
		if (!selectedAlliance) return;

		const { error } = await apiClient.POST("/api/admin/alliances/{id}/clubs", {
			params: { path: { id: selectedAlliance.id } },
			body: { clubId },
		});

		if (error) {
			toast.error(t("Failed to add club to alliance"));
			return;
		}

		toast.success(t("Club added to alliance"));
		router.refresh();
		queryClient.invalidateQueries({ queryKey: ["admin-clubs"] });
	};

	const handleRemoveClub = async (clubId: string) => {
		if (!selectedAlliance) return;

		const { error } = await apiClient.DELETE("/api/admin/alliances/{id}/clubs/{clubId}", {
			params: { path: { id: selectedAlliance.id, clubId } },
		});

		if (error) {
			toast.error(t("Failed to remove club from alliance"));
			return;
		}

		toast.success(t("Club removed from alliance"));
		router.refresh();
	};

	const memberClubIds = selectedAlliance?.clubAlliances?.map((ca) => ca.club.id) || [];
	const availableClubs = clubsData?.filter((club) => !memberClubIds.includes(club.id)) || [];

	return (
		<Credenza open={isOpen} onOpenChange={handleClose}>
			<CredenzaContent className="max-w-2xl">
				{selectedAlliance && (
					<>
						<CredenzaHeader>
							<CredenzaTitle>{selectedAlliance.name}</CredenzaTitle>
							<CredenzaDescription>
								<Badge variant="outline" className="mt-2">
									{selectedAlliance.country.iso2} - {selectedAlliance.country.name}
								</Badge>
							</CredenzaDescription>
						</CredenzaHeader>

						<CredenzaBody className="space-y-6 py-4">
							<div>
								<h3 className="text-sm font-medium mb-2">{t("Description")}</h3>
								<p className="text-sm text-muted-foreground">
									{selectedAlliance.description || t("No description provided")}
								</p>
							</div>

							<div>
								<div className="flex items-center justify-between mb-2">
									<h3 className="text-sm font-medium">{t("Member Clubs")}</h3>
									<Badge variant="secondary">
										{selectedAlliance.clubAlliances?.length || 0} {t("clubs")}
									</Badge>
								</div>

								<div className="space-y-3">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
										<Input
											placeholder={t("Search clubs to add...")}
											value={clubSearch}
											onChange={(e) => handleSearchChange(e.target.value)}
											className="pl-9 pr-9"
										/>
										{clubSearch && (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => {
													setClubSearch("");
													setDebouncedSearch("");
												}}
												className="absolute right-0 top-1/2 -translate-y-1/2 h-full"
											>
												<X className="h-4 w-4" />
											</Button>
										)}
									</div>

									{clubSearch && availableClubs.length > 0 && (
										<div className="border rounded-md p-2 space-y-1 max-h-[200px] overflow-auto">
											<p className="text-xs text-muted-foreground px-2 py-1">
												{t("Available clubs")}
											</p>
											{availableClubs.map((club) => (
												<div
													key={club.id}
													className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
												>
													<ClubAvatar name={club.name} logo={club.logo} size={40} />
													<div className="flex-1 min-w-0">
														<p className="font-medium truncate">{club.name}</p>
														{club.location && (
															<p className="text-sm text-muted-foreground truncate">
																{club.location}
															</p>
														)}
													</div>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => handleAddClub(club.id)}
													>
														<Plus className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									)}

									{selectedAlliance.clubAlliances && selectedAlliance.clubAlliances.length > 0 ? (
										<div className="space-y-2 max-h-[300px] overflow-auto">
											{selectedAlliance.clubAlliances.map((clubAlliance) => (
												<div
													key={clubAlliance.club.id}
													className="flex items-center gap-3 p-2 rounded-md border"
												>
													<ClubAvatar
														name={clubAlliance.club.name}
														logo={clubAlliance.club.logo}
														size={40}
													/>
													<div className="flex-1 min-w-0">
														<p className="font-medium truncate">{clubAlliance.club.name}</p>
														{clubAlliance.club.location && (
															<p className="text-sm text-muted-foreground truncate">
																{clubAlliance.club.location}
															</p>
														)}
													</div>
													<Button
														size="sm"
														variant="ghost"
														onClick={() => handleRemoveClub(clubAlliance.club.id)}
														className="text-destructive hover:text-destructive"
													>
														<Minus className="h-4 w-4" />
													</Button>
												</div>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground text-center py-4">
											{t("No clubs in this alliance")}
										</p>
									)}
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4 pt-4 border-t">
								<div>
									<h3 className="text-sm font-medium mb-1">{t("Created")}</h3>
									<p className="text-sm text-muted-foreground">
										{format(new Date(selectedAlliance.createdAt), "PPP")}
									</p>
								</div>
								<div>
									<h3 className="text-sm font-medium mb-1">{t("Last Updated")}</h3>
									<p className="text-sm text-muted-foreground">
										{format(new Date(selectedAlliance.updatedAt), "PPP")}
									</p>
								</div>
							</div>
						</CredenzaBody>
					</>
				)}
			</CredenzaContent>
		</Credenza>
	);
}
