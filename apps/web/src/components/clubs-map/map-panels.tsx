import {
	ArrowUpRightIcon,
	BadgeCheck,
	ChevronDown,
	Globe,
	List,
	Mail,
	Phone,
	Search,
	Shield,
	SlidersHorizontal,
	Users,
	X,
} from "lucide-react";
import { useExtracted } from "next-intl";
import type { ComponentType, ReactNode } from "react";
import { InstagramIcon } from "@/components/icons";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { MiniStatChip } from "@/components/redesign/mini-stat-chip";
import { VerifiedBadge } from "@/components/redesign/verified-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** The part of a club the panels need. `MapClub` in `clubs-map.tsx` satisfies it. */
export interface PanelClub {
	id: string;
	name: string;
	latitude: number | null;
	longitude: number | null;
	location: string | null;
	city?: string | null;
	countryId?: number | null;
	memberCount?: number | null;
	logo: string | null;
	logoTile?: "paper" | "ink" | null;
	slug?: string | null;
	verified?: boolean;
	isAllied?: boolean;
	dateFounded?: string | null;
	website?: string | null;
	instagramUsername?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
}

export interface MapFilterState {
	query: string;
	verified: boolean;
	allied: boolean;
	country: number | null;
}

export interface MapCountry {
	id: number;
	name: string;
}

export function filterClubs<T extends PanelClub>(clubs: T[], filters: MapFilterState): T[] {
	const query = filters.query.trim().toLowerCase();
	return clubs.filter((club) => {
		if (filters.verified && !club.verified) {
			return false;
		}
		if (filters.allied && !club.isAllied) {
			return false;
		}
		if (filters.country !== null && club.countryId !== filters.country) {
			return false;
		}
		if (!query) {
			return true;
		}
		return `${club.name} ${club.city ?? ""} ${club.location ?? ""}`.toLowerCase().includes(query);
	});
}

export function directionsHref(club: PanelClub): string | null {
	if (typeof club.latitude !== "number" || typeof club.longitude !== "number") {
		return null;
	}
	return `https://www.google.com/maps/dir/?api=1&destination=${club.latitude},${club.longitude}`;
}

export interface ClubWithDistance<T extends PanelClub> {
	club: T;
	/** Kilometres from the centre of the map, or null before the map is ready. */
	km: number | null;
}

const chipClass =
	"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50";

function ToggleChip({ pressed, onToggle, children }: { pressed: boolean; onToggle: () => void; children: string }) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={onToggle}
			className={cn(
				chipClass,
				pressed ? "border-brand bg-brand-soft text-foreground" : "text-muted-foreground hover:text-foreground",
			)}
		>
			{children}
			{pressed ? <X className="size-3" aria-hidden={true} /> : null}
		</button>
	);
}

interface FilterControlsProps {
	filters: MapFilterState;
	countries: MapCountry[];
	onChange: (patch: Partial<MapFilterState>) => void;
}

export function FilterChips({ filters, countries, onChange }: FilterControlsProps) {
	const t = useExtracted();
	return (
		<div className="flex flex-wrap gap-1.5">
			<ToggleChip pressed={filters.verified} onToggle={() => onChange({ verified: !filters.verified })}>
				{t("Verified")}
			</ToggleChip>
			<ToggleChip pressed={filters.allied} onToggle={() => onChange({ allied: !filters.allied })}>
				{t("Allied")}
			</ToggleChip>
			{countries.length > 1 ? (
				<span className="relative inline-flex">
					<select
						aria-label={t("Country")}
						value={filters.country ?? ""}
						onChange={(event) =>
							onChange({ country: event.target.value ? Number(event.target.value) : null })
						}
						className={cn(
							chipClass,
							"appearance-none bg-transparent pr-7",
							filters.country === null
								? "text-muted-foreground"
								: "border-brand bg-brand-soft text-foreground",
						)}
					>
						<option value="">{t("Country")}</option>
						{countries.map((country) => (
							<option key={country.id} value={country.id}>
								{country.name}
							</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute top-2.5 right-2.5 size-3" aria-hidden={true} />
				</span>
			) : null}
		</div>
	);
}

export function SearchField({
	value,
	onChange,
	onEnter,
	className,
	children,
}: {
	value: string;
	onChange: (value: string) => void;
	onEnter: () => void;
	className?: string;
	children?: ReactNode;
}) {
	const t = useExtracted();
	return (
		<div className={cn("relative flex items-center", className)}>
			<Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" aria-hidden={true} />
			<input
				type="search"
				value={value}
				aria-label={t("Search clubs")}
				placeholder={t("Club or city")}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						onEnter();
					}
				}}
				className="h-10 w-full rounded-md border bg-background pr-10 pl-9 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
			/>
			{children}
		</div>
	);
}

function formatKm(km: number | null): string {
	return km === null ? "" : `${Math.round(km)} km`;
}

function ClubRow<T extends PanelClub>({
	entry,
	selected,
	onSelect,
}: {
	entry: ClubWithDistance<T>;
	selected: boolean;
	onSelect: (club: T) => void;
}) {
	const { club, km } = entry;
	const t = useExtracted();
	const subtitle = [club.city ?? club.location, formatKm(km)].filter(Boolean).join(" · ");
	return (
		<button
			type="button"
			aria-current={selected ? "true" : undefined}
			onClick={() => onSelect(club)}
			className={cn(
				"flex w-full touch-manipulation items-center gap-3 rounded-md p-2 text-left outline-none transition-colors hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50",
				selected && "bg-secondary",
			)}
		>
			<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={32} />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-[13px] font-semibold">{club.name}</span>
				<span className="truncate text-xs text-muted-foreground">{subtitle}</span>
			</span>
			{club.verified ? <VerifiedBadge label={t("Verified club")} className="text-sm" /> : null}
		</button>
	);
}

function CountLabel({ count, searching }: { count: number; searching: boolean }) {
	const t = useExtracted();
	return searching
		? t("{count} clubs found", { count: String(count) })
		: t("{count} clubs in this area", { count: String(count) });
}

interface SidebarProps<T extends PanelClub> extends FilterControlsProps {
	entries: ClubWithDistance<T>[];
	searching: boolean;
	selectedId: string | null;
	onSelect: (club: T) => void;
	onEnter: () => void;
}

/** Desktop list panel: search, filters, the count and every club in view. */
export function MapSidebar<T extends PanelClub>({
	filters,
	countries,
	onChange,
	entries,
	searching,
	selectedId,
	onSelect,
	onEnter,
}: SidebarProps<T>) {
	const t = useExtracted();
	return (
		<aside
			aria-label={t("Clubs on the map")}
			className="hidden w-80 shrink-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground md:flex"
		>
			<div className="flex flex-col gap-3 border-b p-4">
				<SearchField value={filters.query} onChange={(query) => onChange({ query })} onEnter={onEnter} />
				<FilterChips filters={filters} countries={countries} onChange={onChange} />
				<p aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
					<CountLabel count={entries.length} searching={searching} />
				</p>
			</div>
			<ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2">
				{entries.map((entry) => (
					<li key={entry.club.id}>
						<ClubRow entry={entry} selected={entry.club.id === selectedId} onSelect={onSelect} />
					</li>
				))}
				{entries.length === 0 ? (
					<li className="p-4 text-center text-sm text-muted-foreground">{t("No clubs found")}</li>
				) : null}
			</ul>
		</aside>
	);
}

interface PeekProps<T extends PanelClub> {
	entries: ClubWithDistance<T>[];
	searching: boolean;
	expanded: boolean;
	onToggleList: () => void;
	onSelect: (club: T) => void;
}

/** Phone bottom card: the count and the three nearest clubs. The List button opens them all. */
export function MapPeek<T extends PanelClub>({ entries, searching, expanded, onToggleList, onSelect }: PeekProps<T>) {
	const t = useExtracted();
	const rows = expanded ? entries : entries.slice(0, 3);
	return (
		<section
			aria-label={t("Clubs on the map")}
			className="absolute inset-x-3 bottom-3 z-[1200] flex max-h-[60dvh] flex-col rounded-xl border bg-card p-2 text-card-foreground shadow-lg md:hidden"
		>
			<div className="flex items-center justify-between gap-2 px-2 py-1">
				<p aria-live="polite" className="text-[13px] tabular-nums">
					<CountLabel count={entries.length} searching={searching} />
				</p>
				<Button variant="secondary" size="sm" onClick={onToggleList} aria-expanded={expanded}>
					<List aria-hidden={true} />
					{expanded ? t("Close") : t("List")}
				</Button>
			</div>
			<ul className="mt-1 flex min-h-0 flex-col overflow-y-auto overscroll-contain border-t pt-1">
				{rows.map((entry) => (
					<li key={entry.club.id}>
						<ClubRow entry={entry} selected={false} onSelect={onSelect} />
					</li>
				))}
			</ul>
		</section>
	);
}

interface PillProps extends FilterControlsProps {
	onEnter: () => void;
	filtersOpen: boolean;
	onToggleFilters: () => void;
}

/** Phone search pill with a filter toggle. */
export function MapPill({ filters, countries, onChange, onEnter, filtersOpen, onToggleFilters }: PillProps) {
	const t = useExtracted();
	return (
		<div className="flex flex-col gap-2 rounded-xl border bg-card p-2 shadow-lg">
			<SearchField value={filters.query} onChange={(query) => onChange({ query })} onEnter={onEnter}>
				<button
					type="button"
					aria-label={t("Filters")}
					aria-expanded={filtersOpen}
					onClick={onToggleFilters}
					className="absolute right-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<SlidersHorizontal className="size-4" aria-hidden={true} />
				</button>
			</SearchField>
			{filtersOpen ? <FilterChips filters={filters} countries={countries} onChange={onChange} /> : null}
		</div>
	);
}

function useContactLinks(club: PanelClub) {
	const t = useExtracted();
	const links: { href: string; label: string; icon: ComponentType<{ className?: string }> }[] = [];
	if (club.website) {
		links.push({ href: club.website, label: t("Website"), icon: Globe });
	}
	if (club.instagramUsername && !club.website?.includes("instagram.com")) {
		links.push({
			href: `https://instagram.com/${club.instagramUsername}`,
			label: t("Instagram"),
			icon: InstagramIcon,
		});
	}
	if (club.contactEmail) {
		links.push({ href: `mailto:${club.contactEmail}`, label: t("Email"), icon: Mail });
	}
	if (club.contactPhone) {
		links.push({ href: `tel:${club.contactPhone}`, label: t("Call"), icon: Phone });
	}
	return links;
}

/** The selected club: who they are, how big, and the two ways forward. */
export function ClubCompactCard({ club, onClose }: { club: PanelClub; onClose: () => void }) {
	const t = useExtracted();
	const contactLinks = useContactLinks(club);
	const directions = directionsHref(club);
	const since = club.dateFounded ? new Date(club.dateFounded).getFullYear() : null;
	const place = [club.city ?? club.location, since ? t("since {year}", { year: String(since) }) : null].filter(
		Boolean,
	);
	return (
		<div className="flex flex-col gap-3 p-4">
			<div className="flex items-center gap-3">
				<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={44} />
				<div className="flex min-w-0 flex-1 flex-col">
					<h3 className="flex items-center gap-1.5 text-base font-semibold">
						<span className="truncate">{club.name}</span>
						{club.verified ? <VerifiedBadge label={t("Verified club")} className="text-sm" /> : null}
					</h3>
					<span className="truncate text-xs text-muted-foreground">{place.join(" · ")}</span>
				</div>
				<Button variant="ghost" size="sm" aria-label={t("Close")} className="size-8 p-0" onClick={onClose}>
					<X className="size-4" aria-hidden={true} />
				</Button>
			</div>
			<div className="flex flex-wrap gap-1.5">
				{club.memberCount ? <MiniStatChip icon={Users} value={club.memberCount} label={t("members")} /> : null}
				{club.isAllied ? <MiniStatChip icon={Shield} value={t("Allied")} /> : null}
				{club.verified ? <MiniStatChip icon={BadgeCheck} value={t("Verified")} /> : null}
			</div>
			<div className="flex gap-2">
				<Button asChild={true} size="sm" className="flex-1">
					<Link href={`/clubs/${club.slug || club.id}`}>{t("View club")}</Link>
				</Button>
				{directions ? (
					<Button asChild={true} variant="secondary" size="sm">
						<a href={directions} target="_blank" rel="noopener noreferrer">
							{t("Directions")}
							<ArrowUpRightIcon aria-hidden={true} />
						</a>
					</Button>
				) : null}
			</div>
			<ul className="flex gap-1">
				{contactLinks.map(({ href, label, icon: Icon }) => (
					<li key={label}>
						<Button asChild={true} variant="ghost" size="sm" className="size-8 p-0">
							<a
								href={href}
								target={href.startsWith("http") ? "_blank" : undefined}
								rel="noopener noreferrer"
								aria-label={label}
							>
								<Icon className="size-4" />
							</a>
						</Button>
					</li>
				))}
			</ul>
		</div>
	);
}
