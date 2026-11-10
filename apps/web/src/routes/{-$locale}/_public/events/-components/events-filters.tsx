import { useExtracted } from "next-intl";
import { useState } from "react";
import { FacetCheckbox, FilterGroup } from "@/components/redesign/filter-group";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
	PRICE_SLIDER_MAX,
	REGISTRATION_STATES,
	type RegistrationFilter,
	type WHEN_VALUES,
} from "@/routes/{-$locale}/_public/events/-components/events-search";

export interface EventsFacets {
	registration: Record<RegistrationFilter, number>;
	country: { countryId: number; name: string; count: number }[];
}

export interface FilterValues {
	when: (typeof WHEN_VALUES)[number] | null;
	from: string | null;
	to: string | null;
	reg: RegistrationFilter[];
	country: number[];
	city: string;
	maxPrice: number | null;
	freelancers: boolean;
	verified: boolean;
}

export type FilterPatch = Partial<FilterValues>;

interface EventsFiltersProps {
	values: FilterValues;
	facets: EventsFacets | null;
	onChange: (patch: FilterPatch) => void;
}

function toggle<T>(list: T[], item: T, on: boolean) {
	return on ? [...list, item] : list.filter((entry) => entry !== item);
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"inline-flex h-8 items-center rounded-full px-3 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				active
					? "bg-primary text-primary-foreground"
					: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
			)}
		>
			{children}
		</button>
	);
}

function WhenGroup({ values, onChange }: Omit<EventsFiltersProps, "facets">) {
	const t = useExtracted();
	const [pickOpen, setPickOpen] = useState(false);
	const picking = pickOpen || Boolean(values.from || values.to);
	return (
		<FilterGroup title={t("When")}>
			<div className="flex flex-wrap gap-1.5">
				<ChipButton
					active={values.when === "weekend"}
					onClick={() =>
						onChange({ when: values.when === "weekend" ? null : "weekend", from: null, to: null })
					}
				>
					{t("This weekend")}
				</ChipButton>
				<ChipButton
					active={values.when === "next30"}
					onClick={() => onChange({ when: values.when === "next30" ? null : "next30", from: null, to: null })}
				>
					{t("Next 30 days")}
				</ChipButton>
				<ChipButton
					active={picking}
					onClick={() => {
						setPickOpen(!picking);
						onChange({ when: null, from: null, to: null });
					}}
				>
					{t("Pick dates")}
				</ChipButton>
			</div>
			{picking ? (
				<div className="grid grid-cols-2 gap-2">
					<div className="flex flex-col gap-1 text-xs text-muted-foreground">
						<span aria-hidden={true}>{t("From")}</span>
						<Input
							aria-label={t("From")}
							type="date"
							value={values.from ?? ""}
							max={values.to ?? undefined}
							onChange={(event) => onChange({ when: null, from: event.target.value || null })}
						/>
					</div>
					<div className="flex flex-col gap-1 text-xs text-muted-foreground">
						<span aria-hidden={true}>{t("To")}</span>
						<Input
							aria-label={t("To")}
							type="date"
							value={values.to ?? ""}
							min={values.from ?? undefined}
							onChange={(event) => onChange({ when: null, to: event.target.value || null })}
						/>
					</div>
				</div>
			) : null}
		</FilterGroup>
	);
}

function RegistrationGroup({ values, facets, onChange }: EventsFiltersProps) {
	const t = useExtracted();
	const labels: Record<RegistrationFilter, string> = {
		open: t("Open"),
		notOpenYet: t("Not open yet"),
		full: t("Full"),
		closed: t("Closed"),
	};
	return (
		<FilterGroup title={t("Registration")}>
			{REGISTRATION_STATES.map((state) => (
				<FacetCheckbox
					key={state}
					label={labels[state]}
					count={facets?.registration[state]}
					checked={values.reg.includes(state)}
					onCheckedChange={(on) => onChange({ reg: toggle(values.reg, state, on) })}
				/>
			))}
		</FilterGroup>
	);
}

function CountryGroup({ values, facets, onChange }: EventsFiltersProps) {
	const t = useExtracted();
	if (!facets?.country.length) {
		return null;
	}
	return (
		<FilterGroup title={t("Country")}>
			{facets.country.map((country) => (
				<FacetCheckbox
					key={country.countryId}
					label={country.name}
					count={country.count}
					checked={values.country.includes(country.countryId)}
					onCheckedChange={(on) => onChange({ country: toggle(values.country, country.countryId, on) })}
				/>
			))}
		</FilterGroup>
	);
}

function PriceGroup({ values, onChange }: Omit<EventsFiltersProps, "facets">) {
	const t = useExtracted();
	const [draft, setDraft] = useState<number | null>(null);
	const value = draft ?? values.maxPrice ?? PRICE_SLIDER_MAX;
	const any = value >= PRICE_SLIDER_MAX;
	return (
		<FilterGroup title={t("Max price")}>
			<div className="flex justify-between text-xs text-muted-foreground tabular-nums">
				<span>{t("Free")}</span>
				<span>{any ? t("Any price") : t("Up to {price} KM", { price: String(value) })}</span>
			</div>
			<Slider
				min={0}
				max={PRICE_SLIDER_MAX}
				step={5}
				value={[value]}
				aria-label={t("Max price")}
				onValueChange={([next]) => setDraft(next ?? value)}
				onValueCommit={([next = value]) => {
					setDraft(null);
					onChange({ maxPrice: next >= PRICE_SLIDER_MAX ? null : next });
				}}
			/>
		</FilterGroup>
	);
}

export function EventsFilters({ values, facets, onChange }: EventsFiltersProps) {
	const t = useExtracted();
	return (
		<>
			<WhenGroup values={values} onChange={onChange} />
			<RegistrationGroup values={values} facets={facets} onChange={onChange} />
			<CountryGroup values={values} facets={facets} onChange={onChange} />
			<FilterGroup title={t("City")}>
				<Input
					type="search"
					value={values.city}
					placeholder={t("Any city")}
					aria-label={t("City")}
					onChange={(event) => onChange({ city: event.target.value })}
				/>
			</FilterGroup>
			<PriceGroup values={values} onChange={onChange} />
			<FilterGroup title={t("Other")}>
				<FacetCheckbox
					label={t("Freelancers welcome")}
					checked={values.freelancers}
					onCheckedChange={(on) => onChange({ freelancers: on })}
				/>
				<FacetCheckbox
					label={t("Verified clubs only")}
					checked={values.verified}
					onCheckedChange={(on) => onChange({ verified: on })}
				/>
			</FilterGroup>
		</>
	);
}
