import NoResults from "@public/errors/no-results.png";
import { useExtracted } from "next-intl";
import { Image } from "@/components/image";
import { FacetCheckbox, FilterGroup, FilterSelect } from "@/components/redesign/filter-group";
import { ListingPagination } from "@/components/redesign/listing-pagination";
import { type ListingChip, ListingShell } from "@/components/redesign/listing-shell";
import { useDebouncedSearch } from "@/components/redesign/use-debounced-search";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import { ClubCard } from "@/routes/{-$locale}/_public/clubs/-components/club-card";
import { CLUB_SIZES, type ClubsSearch } from "@/routes/{-$locale}/_public/clubs/-components/clubs-search";

type ClubsResponse = ApiResponse<"/api/clubs", "get">;

export interface ClubsListingData {
	clubs: ClubsResponse["clubs"];
	pagination: ClubsResponse["pagination"];
	totals?: ClubsResponse["totals"];
	facets?: ClubsResponse["facets"];
	countries: { id: number; name: string }[];
	cities: { slug: string; name: string; count: number }[];
}

interface ClubsListingProps {
	data: ClubsListingData;
	search: ClubsSearch;
	onSearchChange: (patch: Partial<ClubsSearch>) => void;
	onPageChange: (page: number) => void;
	onReset: () => void;
}

function countryCount(facets: ClubsListingData["facets"], id: number) {
	return facets?.country.find((entry) => entry.countryId === id)?.count ?? null;
}

function useFilterChips({ data, search, onSearchChange }: ClubsListingProps) {
	const t = useExtracted();
	const chips: ListingChip[] = [];
	const country = data.countries.find((entry) => entry.id === search.country);
	if (country) {
		chips.push({ key: "country", label: country.name, onRemove: () => onSearchChange({ country: undefined }) });
	}
	const city = data.cities.find((entry) => entry.slug === search.city);
	if (search.city) {
		chips.push({
			key: "city",
			label: city?.name ?? search.city,
			onRemove: () => onSearchChange({ city: undefined }),
		});
	}
	const sizeLabels = {
		small: t("Under 15 members"),
		medium: t("15 - 40 members"),
		large: t("Over 40 members"),
	};
	if (search.size) {
		chips.push({
			key: "size",
			label: sizeLabels[search.size],
			onRemove: () => onSearchChange({ size: undefined }),
		});
	}
	if (search.verified) {
		chips.push({ key: "verified", label: t("Verified"), onRemove: () => onSearchChange({ verified: undefined }) });
	}
	if (search.allied) {
		chips.push({ key: "allied", label: t("Allied"), onRemove: () => onSearchChange({ allied: undefined }) });
	}
	if (search.hasGames) {
		chips.push({
			key: "hasGames",
			label: t("Has upcoming games"),
			onRemove: () => onSearchChange({ hasGames: undefined }),
		});
	}
	return chips;
}

function ClubsFilters({ data, search, onSearchChange }: ClubsListingProps) {
	const t = useExtracted();
	const sizeLabels = {
		small: t("Under 15 members"),
		medium: t("15 - 40 members"),
		large: t("Over 40 members"),
	};
	return (
		<>
			<FilterGroup title={t("Country")}>
				{data.countries.map((country) => (
					<FacetCheckbox
						key={country.id}
						label={country.name}
						count={countryCount(data.facets, country.id)}
						checked={search.country === country.id}
						onCheckedChange={(checked) => onSearchChange({ country: checked ? country.id : undefined })}
					/>
				))}
			</FilterGroup>
			<FilterSelect
				label={t("City")}
				placeholder={t("Any city")}
				value={search.city ?? ""}
				onChange={(value) => onSearchChange({ city: value || undefined })}
				options={data.cities.map((city) => ({ value: city.slug, label: `${city.name} (${city.count})` }))}
			/>
			<FilterGroup title={t("Club size")}>
				{CLUB_SIZES.map((size) => (
					<FacetCheckbox
						key={size}
						label={sizeLabels[size]}
						count={data.facets?.size[size]}
						checked={search.size === size}
						onCheckedChange={(checked) => onSearchChange({ size: checked ? size : undefined })}
					/>
				))}
			</FilterGroup>
			<FilterGroup title={t("Other")}>
				<FacetCheckbox
					label={t("Verified clubs")}
					count={data.facets?.verified.verified}
					checked={search.verified === true}
					onCheckedChange={(checked) => onSearchChange({ verified: checked ? true : undefined })}
				/>
				<FacetCheckbox
					label={t("Allied clubs")}
					checked={search.allied === true}
					onCheckedChange={(checked) => onSearchChange({ allied: checked ? true : undefined })}
				/>
				<FacetCheckbox
					label={t("Has upcoming games")}
					checked={search.hasGames === true}
					onCheckedChange={(checked) => onSearchChange({ hasGames: checked ? true : undefined })}
				/>
			</FilterGroup>
		</>
	);
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
	const t = useExtracted();
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center">
			<Image src={NoResults} alt="" draggable={false} className="w-full max-w-[250px] dark:invert" />
			<p className="mt-4 font-medium">{filtered ? t("No clubs match these filters") : t("No clubs yet")}</p>
			<p className="mt-1 max-w-sm text-sm text-muted-foreground">
				{t("Clubs are the teams that organize events and take in players.")}
			</p>
			{filtered ? (
				<button type="button" onClick={onReset} className="mt-4 text-sm underline underline-offset-4">
					{t("Reset filters")}
				</button>
			) : (
				<Link href="/clubs/city" className="mt-4 text-sm underline underline-offset-4">
					{t("Browse by city")}
				</Link>
			)}
		</div>
	);
}

export function ClubsListing(props: ClubsListingProps) {
	const t = useExtracted();
	const { data, search, onSearchChange, onPageChange, onReset } = props;
	const searchBox = useDebouncedSearch(search.q ?? "", (q) => onSearchChange({ q: q || undefined }));
	const chips = useFilterChips(props);
	const totals = data.totals;
	return (
		<div className="container max-w-7xl px-4 py-8">
			<ListingShell
				title={t("Clubs")}
				subtitle={
					totals ? (
						<>
							{t("{count, plural, one {# club} other {# clubs}}", { count: totals.clubCount })}
							{" · "}
							{t("{count, plural, one {# city} other {# cities}}", { count: totals.cityCount })}
							{" · "}
							{t("{count, plural, one {# country} other {# countries}}", { count: totals.countryCount })}
							{" · "}
							<Link href="/clubs/city" className="underline underline-offset-4">
								{t("Browse by city")}
							</Link>
						</>
					) : undefined
				}
				search={{
					...searchBox,
					placeholder: t("Club name or city"),
					label: t("Search clubs"),
				}}
				sort={{
					value: search.sort ?? "",
					onChange: (value) => onSearchChange({ sort: (value || undefined) as ClubsSearch["sort"] }),
					options: [
						{ value: "", label: t("Recommended") },
						{ value: "members", label: t("Most members") },
						{ value: "rating", label: t("Top rated") },
						{ value: "newest", label: t("Newest") },
						{ value: "name", label: t("Name") },
					],
				}}
				chips={chips}
				resultCount={data.pagination.total}
				filters={<ClubsFilters {...props} />}
				activeFilterCount={chips.length}
				onResetFilters={onReset}
			>
				{data.clubs.length === 0 ? (
					<EmptyState filtered={chips.length > 0 || Boolean(search.q)} onReset={onReset} />
				) : (
					<ul className="m-0 flex list-none flex-col gap-3 p-0">
						{data.clubs.map((club) => (
							<li key={club.id} className="@container">
								<ClubCard club={club} />
							</li>
						))}
					</ul>
				)}
				<ListingPagination
					page={data.pagination.page}
					totalPages={data.pagination.totalPages}
					onPageChange={onPageChange}
				/>
			</ListingShell>
		</div>
	);
}
