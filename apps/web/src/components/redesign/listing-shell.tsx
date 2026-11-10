import { Search, SlidersHorizontal, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import type { IconComponent } from "@/components/redesign/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface ViewToggleOption {
	value: string;
	label: string;
	icon?: IconComponent;
}

interface ViewToggleProps {
	options: ViewToggleOption[];
	value: string;
	onChange: (value: string) => void;
	/** Accessible name of the group. */
	label: string;
}

/** A segmented control, for example List, Grid and Calendar. */
export function ViewToggle({ options, value, onChange, label }: ViewToggleProps) {
	return (
		<fieldset className="m-0 inline-flex min-w-0 max-w-full gap-0.5 overflow-x-auto rounded-xl border-0 bg-muted p-[3px]">
			<legend className="sr-only">{label}</legend>
			{options.map((option) => {
				const Icon = option.icon;
				const active = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(option.value)}
						className={cn(
							"inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
							active
								? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_hsl(var(--border))]"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{Icon ? <Icon className="size-3.5" aria-hidden={true} /> : null}
						{option.label}
					</button>
				);
			})}
		</fieldset>
	);
}

export interface ListingChip {
	key: string;
	label: string;
	onRemove: () => void;
}

interface SortOption {
	value: string;
	label: string;
}

interface ListingShellProps {
	title: string;
	subtitle?: ReactNode;
	viewToggle?: ReactNode;
	search: { value: string; onChange: (value: string) => void; placeholder: string; label: string };
	sort?: { value: string; onChange: (value: string) => void; options: SortOption[] };
	chips?: ListingChip[];
	resultCount?: number;
	/** The filter groups. They show in the sidebar, and in the sheet on a narrow container. */
	filters: ReactNode;
	/** The count in the "Filters (n)" button. */
	activeFilterCount?: number;
	onResetFilters?: () => void;
	children: ReactNode;
	className?: string;
}

function SearchField({ search }: Pick<ListingShellProps, "search">) {
	const id = useId();
	return (
		<div className="flex h-11 min-w-[200px] flex-1 items-center gap-2.5 rounded-md border border-input bg-background px-3.5 text-muted-foreground focus-within:border-ring">
			<Search className="size-4 shrink-0" aria-hidden={true} />
			<label htmlFor={id} className="sr-only">
				{search.label}
			</label>
			<input
				id={id}
				type="search"
				value={search.value}
				placeholder={search.placeholder}
				onChange={(event) => search.onChange(event.target.value)}
				className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
			/>
		</div>
	);
}

function SortField({ sort }: { sort: NonNullable<ListingShellProps["sort"]> }) {
	const t = useExtracted();
	const id = useId();
	return (
		<div className="hidden h-11 min-w-[200px] items-center gap-2 rounded-md border border-input bg-background px-3.5 focus-within:border-ring @min-[821px]:flex">
			<label htmlFor={id} className="text-xs text-muted-foreground">
				{t("Sort")}
			</label>
			<select
				id={id}
				value={sort.value}
				onChange={(event) => sort.onChange(event.target.value)}
				className="flex-1 cursor-pointer border-0 bg-transparent text-sm text-foreground outline-none"
			>
				{sort.options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	);
}

function FilterChips({ chips, resultCount }: Pick<ListingShellProps, "chips" | "resultCount">) {
	const t = useExtracted();
	const hasChips = Boolean(chips?.length);
	if (!hasChips && resultCount === undefined) {
		return null;
	}
	return (
		<div className="flex flex-wrap items-center gap-2">
			{chips?.map((chip) => (
				<button
					key={chip.key}
					type="button"
					onClick={chip.onRemove}
					className="inline-flex h-8 items-center gap-2 rounded-full bg-secondary px-3 text-[13px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{chip.label}
					<X className="size-3.5" aria-hidden={true} />
					<span className="sr-only">{t("Remove filter")}</span>
				</button>
			))}
			{resultCount === undefined ? null : (
				<span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
					{t("{count, plural, one {# result} other {# results}}", { count: resultCount })}
				</span>
			)}
		</div>
	);
}

function FiltersPanel({ filters, onReset }: { filters: ReactNode; onReset?: () => void }) {
	const t = useExtracted();
	return (
		<>
			<div className="flex items-center justify-between border-b px-6 py-4">
				<h2 className="text-[15px] font-semibold">{t("Filters")}</h2>
				{onReset ? (
					<button
						type="button"
						onClick={onReset}
						className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
					>
						{t("Reset")}
					</button>
				) : null}
			</div>
			<div className="flex flex-col gap-5 px-6 py-5">{filters}</div>
		</>
	);
}

export function ListingShell({
	title,
	subtitle,
	viewToggle,
	search,
	sort,
	chips,
	resultCount,
	filters,
	activeFilterCount,
	onResetFilters,
	children,
	className,
}: ListingShellProps) {
	const t = useExtracted();
	const [sheetOpen, setSheetOpen] = useState(false);
	return (
		<div className={cn("@container w-full", className)}>
			<div className="mb-5 flex flex-wrap items-end justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-[28px] leading-[34px] font-bold tracking-tight @min-[821px]:text-[40px] @min-[821px]:leading-[46px]">
						{title}
					</h1>
					{subtitle ? (
						<p className="text-[13px] leading-5 text-muted-foreground tabular-nums">{subtitle}</p>
					) : null}
				</div>
				{viewToggle}
			</div>
			<div className="flex items-start gap-6">
				<aside className="sticky top-6 hidden w-[268px] shrink-0 overflow-hidden rounded-lg border bg-card @min-[821px]:block">
					<FiltersPanel filters={filters} onReset={onResetFilters} />
				</aside>
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					<div className="flex flex-wrap gap-2">
						<SearchField search={search} />
						<Button
							type="button"
							variant="outline"
							className="h-11 @min-[821px]:hidden"
							onClick={() => setSheetOpen(true)}
						>
							<SlidersHorizontal aria-hidden={true} />
							{t("Filters")}
							{activeFilterCount ? <span className="tabular-nums">({activeFilterCount})</span> : null}
						</Button>
						{sort ? <SortField sort={sort} /> : null}
					</div>
					<FilterChips chips={chips} resultCount={resultCount} />
					{children}
				</div>
			</div>
			<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
				<SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto">
					<SheetHeader className="sr-only">
						<SheetTitle>{t("Filters")}</SheetTitle>
						<SheetDescription>{t("Narrow down the results")}</SheetDescription>
					</SheetHeader>
					<FiltersPanel filters={filters} onReset={onResetFilters} />
				</SheetContent>
			</Sheet>
		</div>
	);
}
