import { ArrowUpRight, Clock, SlidersHorizontal } from "lucide-react";
import { useExtracted } from "next-intl";
import { FacetCheckbox, FilterGroup } from "@/components/redesign/filter-group";
import { SectionCard } from "@/components/redesign/section-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchParams } from "@/routes/{-$locale}/_public/search/-components/search-state";
import { useCountryIds } from "@/routes/{-$locale}/_public/search/-components/use-search-data";

const COUNTRY_CHIPS = [
	{ iso2: "BA", label: "BiH" },
	{ iso2: "RS", label: "SRB" },
	{ iso2: "ME", label: "MNE" },
	{ iso2: "HR", label: "HRV" },
] as const;

type Patch = Partial<SearchParams>;

function CountryChips({ params, onChange }: { params: SearchParams; onChange: (patch: Patch) => void }) {
	const t = useExtracted();
	const { data: ids } = useCountryIds();
	return (
		<FilterGroup title={t("Country")}>
			<div className="flex flex-wrap gap-1.5">
				{COUNTRY_CHIPS.map((chip) => {
					const id = ids?.get(chip.iso2);
					if (id === undefined) {
						return null;
					}
					const active = params.country === id;
					return (
						<button
							key={chip.iso2}
							type="button"
							aria-pressed={active}
							onClick={() => onChange({ country: active ? null : id })}
							className={cn(
								"h-7 rounded-full border px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
								active
									? "border-transparent bg-primary text-primary-foreground"
									: "bg-secondary text-secondary-foreground hover:border-foreground/30",
							)}
						>
							{chip.label}
						</button>
					);
				})}
			</div>
		</FilterGroup>
	);
}

export function RefineFields({ params, onChange }: { params: SearchParams; onChange: (patch: Patch) => void }) {
	const t = useExtracted();
	return (
		<div className="flex flex-col gap-5">
			<CountryChips params={params} onChange={onChange} />
			<FilterGroup title={t("Events")}>
				<FacetCheckbox
					label={t("Upcoming only")}
					checked={params.upcoming}
					onCheckedChange={(upcoming) => onChange({ upcoming })}
				/>
				<FacetCheckbox
					label={t("Registration open")}
					checked={params.open}
					onCheckedChange={(open) => onChange({ open })}
				/>
			</FilterGroup>
			<FilterGroup title={t("Clubs")}>
				<FacetCheckbox
					label={t("Verified only")}
					checked={params.verified}
					onCheckedChange={(verified) => onChange({ verified })}
				/>
			</FilterGroup>
		</div>
	);
}

/** On a narrow page the filters sit in a disclosure above the results. */
export function RefineDisclosure({ params, onChange }: { params: SearchParams; onChange: (patch: Patch) => void }) {
	const t = useExtracted();
	return (
		<details className="group rounded-lg border bg-card lg:hidden">
			<summary className="flex h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
				<SlidersHorizontal className="size-4" aria-hidden={true} />
				{t("Refine")}
			</summary>
			<div className="border-t p-4">
				<RefineFields params={params} onChange={onChange} />
			</div>
		</details>
	);
}

interface SidebarProps {
	params: SearchParams;
	onChange: (patch: Patch) => void;
	recent: string[];
	onPickRecent: (query: string) => void;
	onClearRecent: () => void;
}

function Kbd({ children }: { children: string }) {
	return <kbd className="rounded border bg-secondary px-1.5 py-0.5 font-mono text-[11px]">{children}</kbd>;
}

export function SearchSidebar({ params, onChange, recent, onPickRecent, onClearRecent }: SidebarProps) {
	const t = useExtracted();
	return (
		<aside className="flex flex-col gap-4" aria-label={t("Refine and recent searches")}>
			<SectionCard title={t("Refine")} headingLevel={2} className="hidden lg:block">
				<RefineFields params={params} onChange={onChange} />
			</SectionCard>
			{recent.length > 0 ? (
				<section className="rounded-lg border bg-card p-4">
					<div className="mb-2 flex items-center justify-between">
						<h2 className="text-sm font-semibold">{t("Recent searches")}</h2>
						<Button type="button" variant="ghost" size="sm" onClick={onClearRecent}>
							{t("Clear")}
						</Button>
					</div>
					<ul className="flex flex-col">
						{recent.map((query) => (
							<li key={query}>
								<button
									type="button"
									onClick={() => onPickRecent(query)}
									className="flex h-9 w-full items-center gap-2 rounded-md px-1 text-left text-[13px] outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden={true} />
									<span className="min-w-0 flex-1 truncate">{query}</span>
									<ArrowUpRight
										className="size-3.5 shrink-0 text-muted-foreground"
										aria-hidden={true}
									/>
								</button>
							</li>
						))}
					</ul>
				</section>
			) : null}
			<p className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground lg:flex">
				<Kbd>/</Kbd> {t("focus search")} <Kbd>↑↓</Kbd> {t("move")} <Kbd>Enter</Kbd> {t("open")}
			</p>
		</aside>
	);
}
