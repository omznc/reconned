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
import { format } from "date-fns";
import { bs } from "date-fns/locale";
import { ArrowUpDown, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

interface CellConfig {
	variant?: "default" | "badge";
	badgeVariants?: Record<string, string>;
	valueMap?: Record<string, string>;
}

interface Column<T> {
	key: keyof T | string;
	header: string;
	cellConfig?: CellConfig;
	sortable?: boolean;
}

interface Filter {
	key: string;
	label: string;
	options: { label: string; value: string }[];
}

interface MobileCardConfig<T> {
	title: keyof T;
	subtitle?: keyof T;
}

interface GenericTableProps<T> {
	data: T[];
	columns: Column<T>[];
	filters?: Filter[];
	searchPlaceholder?: string;
	totalPages: number;
	mobileCardConfig?: MobileCardConfig<T>;
	tableConfig?: {
		dateFormat?: string;
		locale?: "bs" | "en";
	};
}

// biome-ignore lint/suspicious/noExplicitAny: Don't care
const renderCell = <T extends Record<string, any>>(
	item: T,
	column: Column<T>,
	tableConfig?: GenericTableProps<T>["tableConfig"],
) => {
	const value = item[column.key];
	const config = column.cellConfig;

	if (!value) {
		return "-";
	}

	if (
		// @ts-expect-error No you don't
		value instanceof Date ||
		(typeof value === "string" && Date.parse(value))
	) {
		return format(new Date(value), tableConfig?.dateFormat || "PPP", {
			locale: tableConfig?.locale === "bs" ? bs : undefined,
		});
	}

	if (config?.variant === "badge") {
		const badgeClass = config.badgeVariants?.[value] || "bg-primary/10";
		return (
			<span className={`rounded-full px-2 py-1 text-xs ${badgeClass}`}>
				{config.valueMap?.[value] || value}
			</span>
		);
	}

	return config?.valueMap?.[value] || value;
};

export function GenericDataTable<T>({
	data,
	columns,
	filters,
	searchPlaceholder = "Search...",
	totalPages,
	mobileCardConfig,
	tableConfig,
}: GenericTableProps<T>) {
	const [search, setSearch] = useQueryState("search", { shallow: false });
	const [page, setPage] = useQueryState("page", {
		defaultValue: "1",
		shallow: false,
	});
	const [sortBy, setSortBy] = useQueryState("sortBy", { shallow: false });
	const [sortOrder, setSortOrder] = useQueryState("sortOrder", {
		shallow: false,
	});
	const [filterValues, setFilterValues] = useState<Record<string, string>>({});
	const [inputValue, setInputValue] = useState(search ?? "");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const handleSort = async (columnKey: string) => {
		if (sortBy === columnKey) {
			if (sortOrder === "asc") {
				await setSortOrder("desc");
			} else if (sortOrder === "desc") {
				await setSortBy(null);
				await setSortOrder(null); // Reset to default
			}
		} else {
			await setSortBy(columnKey);
			await setSortOrder("asc");
		}
	};

	const debouncedSearch = useDebouncedCallback(async (value: string) => {
		setIsLoading(true);
		await setSearch(value || null);
		setIsLoading(false);
	}, 500);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setInputValue(value);
		debouncedSearch(value);
	};

	const handleFilterChange = async (key: string, value: string) => {
		setFilterValues((prev) => ({ ...prev, [key]: value }));
		await setSearch(search); // Preserve search
		if (value === "all") {
			const searchParams = new URLSearchParams(window.location.search);
			searchParams.delete(key);
			router.push(`?${searchParams.toString()}`);
		} else {
			const searchParams = new URLSearchParams(window.location.search);
			searchParams.set(key, value);
			router.push(`?${searchParams.toString()}`);
		}
	};

	const resetAll = async () => {
		setIsLoading(true);
		await setSearch(null);
		await setSortBy(null);
		await setSortOrder("desc");
		setFilterValues({});
		setInputValue("");
		setIsLoading(false);
	};

	return (
		<div className="space-y-4 w-full">
			{/* Controls */}
			<div className="flex flex-col gap-4 md:flex-row md:items-center">
				<div className="w-full md:w-[300px] relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder={searchPlaceholder}
						value={inputValue}
						onChange={handleSearchChange}
						className="pl-9 pr-9"
					/>
					{inputValue && (
						<Button
							variant="ghost"
							onClick={() =>
								// biome-ignore lint/suspicious/noExplicitAny: Don't care
								handleSearchChange({ target: { value: "" } } as any)
							}
							className="absolute right-0 top-1/2 -translate-y-1/2 hover:bg-transparent"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				{filters?.map((filter) => (
					<Select
						key={filter.key}
						value={filterValues[filter.key] || "all"}
						onValueChange={(value) => handleFilterChange(filter.key, value)}
					>
						<SelectTrigger className="w-full md:w-[180px]">
							<SelectValue placeholder={filter.label} />
						</SelectTrigger>
						<SelectContent>
							{filter.options.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				))}

				<div className="ml-auto text-sm text-muted-foreground">
					Page {page} of {totalPages}
				</div>
			</div>

			{/* Desktop Table */}
			<div className="rounded-md border hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							{columns.map((column) => (
								<TableHead key={column.key.toString()}>
									{column.sortable ? (
										<Button
											variant="ghost"
											onClick={() => handleSort(column.key.toString())}
											className="-ml-4 h-8 hover:bg-transparent"
										>
											{column.header}
											<ArrowUpDown className="ml-2 h-4 w-4" />
										</Button>
									) : (
										column.header
									)}
								</TableHead>
							))}
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.map((item, idx) => (
							<TableRow key={`${idx}-${item}`}>
								{columns.map((column) => (
									<TableCell key={column.key.toString()}>
										{/* @ts-expect-error */}
										{renderCell(item, column, tableConfig)}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			{/* Mobile Cards */}
			<div className="space-y-4 md:hidden">
				{data.map((item, idx) => (
					<div key={`${idx}-${item}`} className="rounded-lg border p-4">
						<div className="font-semibold">
							{mobileCardConfig
								? String(item[mobileCardConfig.title as keyof T])
								: null}
						</div>
						{mobileCardConfig?.subtitle && (
							<div className="text-sm text-muted-foreground">
								{String(item[mobileCardConfig.subtitle as keyof T])}
							</div>
						)}
					</div>
				))}
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-end space-x-2">
				<Button
					variant="outline"
					onClick={() => setPage((prev) => String(Number(prev) - 1))}
					disabled={page === "1"}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					onClick={() => setPage((prev) => String(Number(prev) + 1))}
					disabled={Number(page) >= totalPages}
				>
					Next
				</Button>
			</div>
		</div>
	);
}
