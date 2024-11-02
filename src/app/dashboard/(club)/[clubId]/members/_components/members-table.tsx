"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ClubMembership, User } from "@prisma/client";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	getPaginationRowModel,
	type Row,
} from "@tanstack/react-table";
import { useState, useEffect } from "react";
import { useQueryState } from "nuqs";
import { useDebouncedCallback } from "use-debounce";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { format } from "date-fns";
import { bs } from "date-fns/locale";

type MembershipWithUser = ClubMembership & {
	user: Pick<
		User,
		| "id"
		| "name"
		| "email"
		| "image"
		| "callsign"
		| "location"
		| "bio"
		| "website"
		| "createdAt"
	>;
};

interface MembersTableProps {
	data: MembershipWithUser[];
	searchParams?: {
		search?: string;
		role?: string;
		sortBy?: string;
		sortOrder?: "asc" | "desc";
	};
}

function SortIcon({
	columnKey,
	searchParams,
}: {
	columnKey: string;
	searchParams?: { sortBy?: string; sortOrder?: "asc" | "desc" };
}) {
	if (searchParams?.sortBy !== columnKey) {
		return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
	}
	return searchParams?.sortOrder === "asc" ? (
		<ArrowUp className="ml-2 h-4 w-4 text-primary" />
	) : (
		<ArrowDown className="ml-2 h-4 w-4 text-primary" />
	);
}

// Add MobileCard component
function MobileCard({ row }: { row: Row<MembershipWithUser> }) {
	return (
		<div className="rounded-lg border p-4 space-y-3">
			<div className="flex justify-between items-start">
				<div>
					<div className="font-semibold">{row.original.user?.name || "-"}</div>
					<div className="text-sm text-muted-foreground">
						{row.original.user?.callsign || "-"}
					</div>
				</div>
				<div className="text-sm">
					{format(new Date(row.original.createdAt), "d. MMMM yyyy.", {
						locale: bs,
					})}
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2 text-sm">
				<div>
					<div className="text-muted-foreground">Email</div>
					<div>{row.original.user?.email || "-"}</div>
				</div>
				<div>
					<div className="text-muted-foreground">Lokacija</div>
					<div>{row.original.user?.location || "-"}</div>
				</div>
				<div>
					<div className="text-muted-foreground">Uloga</div>
					<div>
						{(() => {
							const roleMap = {
								USER: "Član",
								MANAGER: "Menadžer",
								CLUB_OWNER: "Vlasnik kluba",
							};
							return roleMap[row.original.role as keyof typeof roleMap] || "-";
						})()}
					</div>
				</div>
			</div>
		</div>
	);
}

export function MembersTable({ data, searchParams }: MembersTableProps) {
	const [search, setSearch] = useQueryState("search", {
		shallow: false,
		clearOnDefault: true,
	});
	const [roleFilter, setRoleFilter] = useQueryState("role", {
		shallow: false,
		defaultValue: "all",
		clearOnDefault: true,
	});
	const [sortBy, setSortBy] = useQueryState("sortBy", {
		shallow: false,
		clearOnDefault: true,
	});
	const [sortOrder, setSortOrder] = useQueryState("sortOrder", {
		shallow: false,
		clearOnDefault: true,
	});
	const [inputValue, setInputValue] = useState(searchParams?.search ?? "");
	const [isLoading, setIsLoading] = useState(false);

	// Debounced search handler
	const debouncedSearch = useDebouncedCallback(async (value: string) => {
		setIsLoading(true);
		await setSearch(value || null);
		setIsLoading(false);
	}, 500);

	// Handle input change with debounce
	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);
		debouncedSearch(value);
	};

	// Reset input value when searchParams change
	useEffect(() => {
		setInputValue(searchParams?.search ?? "");
	}, [searchParams?.search]);

	// Move sort handling to useEffect
	useEffect(() => {
		const handleSort = async (columnKey: string) => {
			const isAsc =
				searchParams?.sortBy === columnKey && searchParams?.sortOrder === "asc";
			await setSortBy(columnKey);
			await setSortOrder(isAsc ? "desc" : "asc");
		};

		// Store in component instance
		table.handleSort = handleSort;
	}, [searchParams?.sortBy, searchParams?.sortOrder, setSortBy, setSortOrder]);

	const resetAll = async () => {
		setIsLoading(true);
		await setSearch(null);
		await setRoleFilter("all");
		await setSortBy(null);
		await setSortOrder(null);
		setInputValue("");
		setIsLoading(false);
	};

	const resetSearch = async () => {
		setInputValue("");
		await setSearch(null);
	};

	const columns: ColumnDef<MembershipWithUser>[] = [
		{
			accessorFn: (row) => row.user?.name,
			id: "userName",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="-ml-4 h-8 hover:bg-transparent"
					onClick={() => table.handleSort?.("userName")}
				>
					Ime
					<SortIcon columnKey="userName" searchParams={searchParams} />
				</Button>
			),
			cell: ({ row }) => row.original.user?.name || "-",
		},
		{
			accessorFn: (row) => row.user?.callsign,
			id: "userCallsign",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="-ml-4 h-8 hover:bg-transparent"
					onClick={() => table.handleSort?.("userCallsign")}
				>
					Pozivni znak
					<SortIcon columnKey="userCallsign" searchParams={searchParams} />
				</Button>
			),
			cell: ({ row }) => row.original.user?.callsign || "-",
		},
		{
			accessorFn: (row) => row.user?.email,
			id: "userEmail",
			header: "Email",
			cell: ({ row }) => row.original.user?.email || "-",
		},
		{
			accessorFn: (row) => row.user?.location,
			id: "userLocation",
			header: "Lokacija",
			cell: ({ row }) => row.original.user?.location || "-",
		},
		{
			accessorKey: "role",
			header: "Uloga",
			cell: ({ row }) => {
				const roleMap = {
					USER: "Član",
					MANAGER: "Menadžer",
					CLUB_OWNER: "Vlasnik kluba",
				};
				return roleMap[row.getValue("role") as keyof typeof roleMap] || "-";
			},
		},
		{
			accessorKey: "createdAt",
			header: ({ column }) => (
				<Button
					variant="ghost"
					className="-ml-4 h-8 hover:bg-transparent"
					onClick={() => table.handleSort?.("createdAt")}
				>
					Datum pridruživanja
					<SortIcon columnKey="createdAt" searchParams={searchParams} />
				</Button>
			),
			cell: ({ row }) => {
				const date = row.getValue("createdAt") as string;
				if (!date) return "-";
				return format(new Date(date), "d. MMMM yyyy.", {
					locale: bs,
				});
			},
		},
	];

	// Extend the table type to include our custom handler
	type TableType = ReturnType<typeof useReactTable> & {
		handleSort?: (columnKey: string) => Promise<void>;
	};

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		state: {
			sorting: sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : [],
		},
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	}) as TableType & { getRowModel(): { rows: Row<MembershipWithUser>[] } };

	return (
		<div className="space-y-4 w-full">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-start w-full">
					{/* First row on mobile - full width search */}
					<div className="relative w-full md:w-[300px] order-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Pretraži članove..."
							value={inputValue}
							onChange={handleSearchChange}
							className="w-full pl-9 pr-9"
							disabled={isLoading}
						/>
						{inputValue && !isLoading && (
							<Button
								variant="ghost"
								onClick={resetSearch}
								className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4" />
							</Button>
						)}
						{isLoading && (
							<div className="absolute right-3 top-1/2 -translate-y-1/2">
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
							</div>
						)}
					</div>

					{/* Second row on mobile - filters and reset */}
					<div className="flex items-center gap-2 order-2 w-full md:w-fit">
						<Select
							defaultValue={searchParams?.role ?? "all"}
							onValueChange={(value) => setRoleFilter(value)}
							disabled={isLoading}
						>
							<SelectTrigger className="w-full md:w-[180px]">
								<SelectValue placeholder="Filtriraj po ulozi" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Sve uloge</SelectItem>
								<SelectItem value="USER">Član</SelectItem>
								<SelectItem value="MANAGER">Menadžer</SelectItem>
								<SelectItem value="CLUB_OWNER">Vlasnik kluba</SelectItem>
							</SelectContent>
						</Select>

						{(search || roleFilter !== "all" || sortBy) && (
							<Button
								variant="ghost"
								size="sm"
								onClick={resetAll}
								disabled={isLoading}
								className="h-10"
							>
								<X className="mr-2 h-4 w-4" />
								Resetuj
							</Button>
						)}
					</div>

					{/* Third row on mobile - pagination */}
					<div className="flex items-center space-x-2 order-3 w-full md:w-auto">
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
							className="w-full md:w-auto"
						>
							Prethodna
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
							className="w-full md:w-auto"
						>
							Sljedeća
						</Button>
					</div>
				</div>
			</div>
			{/* Desktop Table / Mobile Cards */}
			<div className="md:rounded-md md:border">
				<div className="hidden md:block">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead key={header.id}>
											{header.isPlaceholder
												? null
												: flexRender(
														header.column.columnDef.header,
														header.getContext(),
													)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow key={row.id}>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="h-24 text-center"
									>
										{isLoading ? "Učitavanje..." : "Nema rezultata."}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				<div className="space-y-4 md:hidden">
					{table.getRowModel().rows?.length ? (
						table
							.getRowModel()
							// @ts-expect-error TODO: Fix
							.rows.map((row) => <MobileCard key={row.id} row={row} />)
					) : (
						<div className="text-center py-6 text-muted-foreground">
							{isLoading ? "Učitavanje..." : "Nema rezultata."}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
