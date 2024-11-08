"use client";

import React from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Search, X } from "lucide-react";
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { usePathname, useRouter } from "next/navigation";
import type { ClubInvite, InviteStatus, User } from "@prisma/client";
import { useDebouncedCallback } from "use-debounce";

type ClubInviteWithUser = ClubInvite & {
	user?: Pick<User, "id" | "name" | "email"> | null;
};

interface TableProps {
	data: ClubInviteWithUser[];
	totalItems: number;
	currentPage: number;
	pageSize: number;
	searchParams: {
		page?: string;
		pageSize?: string;
		search?: string;
		status?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	};
}

function InviteCard({ invite }: { invite: ClubInviteWithUser }) {
	const isExpired = (expiresAt: Date) => {
		return new Date(expiresAt) < new Date();
	};

	return (
		<div className="rounded-lg border p-4 space-y-3 bg-card">
			<div className="flex justify-between items-start gap-4">
				<div className="min-w-0 flex-1">
					<div className="font-medium truncate">{invite.email}</div>
					<div className="text-sm text-muted-foreground">
						{invite.user?.name || "Nije registrovan"}
					</div>
				</div>
				<InviteStatusBadge status={invite.status} />
			</div>

			<div className="grid grid-cols-2 gap-3 text-sm">
				<div>
					<div className="text-muted-foreground">Datum slanja</div>
					<div>
						{format(new Date(invite.createdAt), "d. MMMM yyyy.", {
							locale: bs,
						})}
					</div>
				</div>
				<div>
					<div className="text-muted-foreground">Ističe</div>
					<div className="flex items-center gap-2">
						<div>
							{format(new Date(invite.expiresAt), "d. MMMM yyyy.", {
								locale: bs,
							})}
						</div>
						{isExpired(invite.expiresAt) && (
							<span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800 shrink-0">
								Isteklo
							</span>
						)}
					</div>
				</div>
				<div className="col-span-2">
					<div className="text-muted-foreground mb-1.5">Kod pozivnice</div>
					<code className="rounded bg-muted px-2 py-1 text-xs">
						{invite.inviteCode}
					</code>
				</div>
			</div>
		</div>
	);
}

const InviteStatusBadge = ({ status }: { status: InviteStatus }) => {
	const statusConfig = {
		// biome-ignore lint/style/useNamingConvention: <explanation>
		PENDING: {
			className: "bg-yellow-100 text-yellow-800",
			label: "Na čekanju",
		},
		// biome-ignore lint/style/useNamingConvention: <explanation>
		ACCEPTED: {
			className: "bg-green-100 text-green-800",
			label: "Prihvaćeno",
		},
		// biome-ignore lint/style/useNamingConvention: <explanation>
		REJECTED: {
			className: "bg-red-100 text-red-800",
			label: "Odbijeno",
		},
		// biome-ignore lint/style/useNamingConvention: <explanation>
		EXPIRED: {
			className: "bg-gray-100 text-gray-800",
			label: "Isteklo",
		},
	};

	const config = statusConfig[status];
	return (
		<span
			className={`rounded-full px-2 py-1 text-xs ${config.className} shrink-0`}
		>
			{config.label}
		</span>
	);
};

const ClubInvitesTable = ({
	data,
	totalItems,
	currentPage,
	pageSize,
	searchParams,
}: TableProps) => {
	const router = useRouter();
	const pathname = usePathname();
	const [isLoading, setIsLoading] = React.useState(false);

	const totalPages = Math.ceil(totalItems / pageSize);
	const canPreviousPage = currentPage > 1;
	const canNextPage = currentPage < totalPages;

	const createQueryString = React.useCallback(
		(params: Record<string, string | null>) => {
			const newSearchParams = new URLSearchParams(
				searchParams as Record<string, string>,
			);

			// biome-ignore lint/complexity/noForEach: <explanation>
			Object.entries(params).forEach(([key, value]) => {
				if (value === null) {
					newSearchParams.delete(key);
				} else {
					newSearchParams.set(key, value);
				}
			});

			return newSearchParams.toString();
		},
		[searchParams],
	);

	const handleSearch = useDebouncedCallback((term: string) => {
		setIsLoading(true);
		const queryString = createQueryString({
			search: term || null,
			page: "1", // Reset to first page on search
		});
		router.push(`${pathname}?${queryString}`);
		setIsLoading(false);
	}, 300);

	const handleStatusChange = (status: string) => {
		const queryString = createQueryString({
			status: status === "all" ? null : status,
			page: "1", // Reset to first page on filter
		});
		router.push(`${pathname}?${queryString}`);
	};

	const handleSort = (key: string) => {
		const isAsc =
			searchParams.sortBy === key && searchParams.sortOrder === "asc";
		const queryString = createQueryString({
			sortBy: key,
			sortOrder: isAsc ? "desc" : "asc",
		});
		router.push(`${pathname}?${queryString}`);
	};

	const handlePageChange = (newPage: number) => {
		const queryString = createQueryString({
			page: newPage.toString(),
		});
		router.push(`${pathname}?${queryString}`);
	};

	return (
		<div className="w-full space-y-4">
			<div className="flex flex-col gap-4 md:items-center md:flex-row">
				<div className="w-full md:w-[300px] relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Pretraži pozivnice..."
						defaultValue={searchParams.search}
						onChange={(e) => handleSearch(e.target.value)}
						className="pl-9 pr-9"
					/>
					{searchParams.search && (
						<Button
							variant="ghost"
							onClick={() => handleSearch("")}
							className="absolute right-0 top-1/2 -translate-y-1/2 hover:bg-transparent"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				<Select
					defaultValue={searchParams.status || "all"}
					onValueChange={handleStatusChange}
				>
					<SelectTrigger className="w-full md:w-[180px]">
						<SelectValue placeholder="Filter po statusu" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Svi statusi</SelectItem>
						<SelectItem value="PENDING">Na čekanju</SelectItem>
						<SelectItem value="ACCEPTED">Prihvaćeno</SelectItem>
						<SelectItem value="REJECTED">Odbijeno</SelectItem>
						<SelectItem value="EXPIRED">Isteklo</SelectItem>
					</SelectContent>
				</Select>

				<div className="ml-auto text-sm text-muted-foreground">
					Stranica {currentPage} od {totalPages}
				</div>
			</div>

			{/* Desktop Table */}
			<div className="rounded-md border hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
								<Button
									variant="ghost"
									onClick={() => handleSort("email")}
									className="-ml-4 h-8 hover:bg-transparent"
								>
									Email
									<ArrowUpDown className="ml-2 h-4 w-4" />
								</Button>
							</TableHead>
							<TableHead>Korisnik</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>
								<Button
									variant="ghost"
									onClick={() => handleSort("createdAt")}
									className="-ml-4 h-8 hover:bg-transparent"
								>
									Datum slanja
									<ArrowUpDown className="ml-2 h-4 w-4" />
								</Button>
							</TableHead>
							<TableHead>
								<Button
									variant="ghost"
									onClick={() => handleSort("expiresAt")}
									className="-ml-4 h-8 hover:bg-transparent"
								>
									Ističe
									<ArrowUpDown className="ml-2 h-4 w-4" />
								</Button>
							</TableHead>
							<TableHead>Kod pozivnice</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.length > 0 ? (
							data.map((invite) => (
								<TableRow key={invite.id}>
									<TableCell>{invite.email}</TableCell>
									<TableCell>{invite.user?.name || "-"}</TableCell>
									<TableCell>
										<InviteStatusBadge status={invite.status} />
									</TableCell>
									<TableCell>
										{format(new Date(invite.createdAt), "d. MMMM yyyy.", {
											locale: bs,
										})}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											{format(new Date(invite.expiresAt), "d. MMMM yyyy.", {
												locale: bs,
											})}
											{new Date(invite.expiresAt) < new Date() && (
												<span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
													Isteklo
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<code className="rounded bg-muted px-2 py-1">
											{invite.inviteCode}
										</code>
									</TableCell>
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={6} className="h-24 text-center">
									{isLoading ? "Učitavanje..." : "Nema rezultata."}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className="space-y-4 md:hidden">
				{data.length > 0 ? (
					data.map((invite) => <InviteCard key={invite.id} invite={invite} />)
				) : (
					<div className="text-center py-6 text-muted-foreground">
						{isLoading ? "Učitavanje..." : "Nema rezultata."}
					</div>
				)}
			</div>

			<div className="flex items-center gap-2 justify-end">
				<Button
					variant="outline"
					onClick={() => handlePageChange(currentPage - 1)}
					disabled={!canPreviousPage}
				>
					Prethodna
				</Button>
				<Button
					variant="outline"
					onClick={() => handlePageChange(currentPage + 1)}
					disabled={!canNextPage}
				>
					Sljedeća
				</Button>
			</div>
		</div>
	);
};

export default ClubInvitesTable;
