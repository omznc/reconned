import NoResults from "@public/errors/no-results.png";
import { ChevronRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { ClubAvatar } from "@/components/identity/club-avatar";
import { Image } from "@/components/image";
import { FilterSelect } from "@/components/redesign/filter-group";
import { ListingPagination } from "@/components/redesign/listing-pagination";
import { type ListingChip, ListingShell } from "@/components/redesign/listing-shell";
import { useDebouncedSearch } from "@/components/redesign/use-debounced-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import type { ApiResponse } from "@/lib/api/api-type-helpers";
import type { UsersSearch } from "@/routes/{-$locale}/_public/users/-components/users-search";

type UsersResponse = ApiResponse<"/api/users", "get">;
type UserItem = UsersResponse["users"][number];

export interface UsersListingData {
	users: UsersResponse["users"];
	pagination: UsersResponse["pagination"];
	countries: { id: number; name: string }[];
	clubs: { id: string; name: string }[];
	cities: { slug: string; name: string }[];
}

interface UsersListingProps {
	data: UsersListingData;
	search: UsersSearch;
	onSearchChange: (patch: Partial<UsersSearch>) => void;
	onPageChange: (page: number) => void;
	onReset: () => void;
}

const DASH = "–";

function PlayerCell({ user }: { user: UserItem }) {
	const t = useExtracted();
	const club = user.clubs[0];
	return (
		<div className="flex min-w-0 items-center gap-3">
			<Avatar className="size-9 shrink-0">
				<AvatarImage src={user.image ?? ""} alt="" />
				<AvatarFallback name={user.name} />
			</Avatar>
			<div className="flex min-w-0 flex-col">
				<Link
					href={`/users/${user.slug || user.id}`}
					className="truncate font-person text-sm leading-5 font-bold tracking-[0.02em] outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
				>
					{user.callsign || user.name}
				</Link>
				{user.callsign ? <span className="truncate text-xs text-muted-foreground">{user.name}</span> : null}
				{club ? (
					<span className="truncate text-xs text-muted-foreground @min-[640px]:hidden">
						{t("Club: {club}", { club: club.name })}
					</span>
				) : null}
			</div>
		</div>
	);
}

function ClubCell({ club }: { club: UserItem["clubs"][number] | undefined }) {
	if (!club) {
		return DASH;
	}
	return (
		<span className="inline-flex min-w-0 items-center gap-2">
			<ClubAvatar name={club.name} logo={club.logo} tile={club.logoTile} size={20} />
			<span className="truncate">{club.name}</span>
		</span>
	);
}

function PlayerRow({ user, rank }: { user: UserItem; rank: number }) {
	const t = useExtracted();
	return (
		<tr className="relative border-b last:border-b-0 hover:bg-muted/40">
			<td className="hidden w-10 px-3 text-xs text-muted-foreground tabular-nums @min-[640px]:table-cell">
				{rank}
			</td>
			<td className="px-3 py-2.5">
				<PlayerCell user={user} />
			</td>
			<td className="hidden max-w-[220px] px-3 text-[13px] @min-[640px]:table-cell">
				<ClubCell club={user.clubs[0]} />
			</td>
			<td className="hidden px-3 text-[13px] text-muted-foreground @min-[640px]:table-cell">
				{user.location || DASH}
			</td>
			<td className="px-3 text-right text-sm font-semibold tabular-nums">
				{user.gamesCount ?? DASH}
				<span className="block text-[11px] font-normal text-muted-foreground @min-[640px]:hidden">
					{t("games")}
				</span>
			</td>
			<td className="hidden px-3 text-right text-[13px] tabular-nums @min-[640px]:table-cell">
				{user.rating ? `${user.rating.average.toFixed(1)} ★` : DASH}
			</td>
			<td className="w-8 pr-3 text-muted-foreground">
				<ChevronRight className="size-4" aria-hidden={true} />
			</td>
		</tr>
	);
}

function PlayersTable({ data }: { data: UsersListingData }) {
	const t = useExtracted();
	const offset = (data.pagination.page - 1) * data.pagination.perPage;
	return (
		<section
			aria-label={t("Players")}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: a keyboard user must be able to scroll the table
			tabIndex={0}
			className="@container overflow-x-auto rounded-lg border bg-card"
		>
			<table className="w-full border-collapse text-left">
				<thead className="@max-[639px]:sr-only">
					<tr className="border-b bg-muted/40 text-xs text-muted-foreground">
						<th scope="col" className="hidden w-10 px-3 py-2.5 font-medium @min-[640px]:table-cell">
							#
						</th>
						<th scope="col" className="px-3 py-2.5 font-medium">
							{t("Player")}
						</th>
						<th scope="col" className="hidden px-3 font-medium @min-[640px]:table-cell">
							{t("Club")}
						</th>
						<th scope="col" className="hidden px-3 font-medium @min-[640px]:table-cell">
							{t("City")}
						</th>
						<th scope="col" className="px-3 text-right font-medium">
							{t("Games")}
						</th>
						<th scope="col" className="hidden px-3 text-right font-medium @min-[640px]:table-cell">
							{t("Rating")}
						</th>
						<th scope="col" className="w-8">
							<span className="sr-only">{t("Open profile")}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{data.users.map((user, index) => (
						<PlayerRow key={user.id} user={user} rank={offset + index + 1} />
					))}
				</tbody>
			</table>
		</section>
	);
}

function UsersFilters({ data, search, onSearchChange }: UsersListingProps) {
	const t = useExtracted();
	return (
		<>
			<FilterSelect
				label={t("Country")}
				placeholder={t("Any country")}
				value={search.country ? String(search.country) : ""}
				onChange={(value) => onSearchChange({ country: value ? Number(value) : undefined })}
				options={data.countries.map((country) => ({ value: String(country.id), label: country.name }))}
			/>
			<FilterSelect
				label={t("Club")}
				placeholder={t("Any club")}
				value={search.club ?? ""}
				onChange={(value) => onSearchChange({ club: value || undefined })}
				options={data.clubs.map((club) => ({ value: club.id, label: club.name }))}
			/>
			<FilterSelect
				label={t("City")}
				placeholder={t("Any city")}
				value={search.city ?? ""}
				onChange={(value) => onSearchChange({ city: value || undefined })}
				options={data.cities.map((city) => ({ value: city.slug, label: city.name }))}
			/>
		</>
	);
}

function useFilterChips({ data, search, onSearchChange }: UsersListingProps) {
	const chips: ListingChip[] = [];
	const country = data.countries.find((entry) => entry.id === search.country);
	if (country) {
		chips.push({ key: "country", label: country.name, onRemove: () => onSearchChange({ country: undefined }) });
	}
	const club = data.clubs.find((entry) => entry.id === search.club);
	if (search.club) {
		chips.push({
			key: "club",
			label: club?.name ?? search.club,
			onRemove: () => onSearchChange({ club: undefined }),
		});
	}
	const city = data.cities.find((entry) => entry.slug === search.city);
	if (search.city) {
		chips.push({
			key: "city",
			label: city?.name ?? search.city,
			onRemove: () => onSearchChange({ city: undefined }),
		});
	}
	return chips;
}

export function UsersListing(props: UsersListingProps) {
	const t = useExtracted();
	const { data, search, onSearchChange, onPageChange, onReset } = props;
	const searchBox = useDebouncedSearch(search.q ?? "", (q) => onSearchChange({ q: q || undefined }));
	const chips = useFilterChips(props);
	const filtered = chips.length > 0 || Boolean(search.q);
	return (
		<div className="container max-w-7xl px-4 py-8">
			<ListingShell
				title={t("Players")}
				subtitle={t("{count, plural, one {# player} other {# players}}", { count: data.pagination.total })}
				search={{ ...searchBox, placeholder: t("Callsign or name"), label: t("Search players") }}
				sort={{
					value: search.sort ?? "",
					onChange: (value) => onSearchChange({ sort: (value || undefined) as UsersSearch["sort"] }),
					options: [
						{ value: "", label: t("Recommended") },
						{ value: "games", label: t("Most games") },
						{ value: "name", label: t("Name") },
						{ value: "newest", label: t("Newest") },
					],
				}}
				chips={chips}
				resultCount={data.pagination.total}
				filters={<UsersFilters {...props} />}
				activeFilterCount={chips.length}
				onResetFilters={onReset}
			>
				{data.users.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center">
						<Image src={NoResults} alt="" draggable={false} className="w-full max-w-[250px] dark:invert" />
						<p className="mt-4 font-medium">
							{filtered ? t("No players match these filters") : t("No players yet")}
						</p>
						<p className="mt-1 max-w-sm text-sm text-muted-foreground">
							{t("Players show up here once they create a profile and join a club.")}
						</p>
						{filtered ? (
							<button
								type="button"
								onClick={onReset}
								className="mt-4 text-sm underline underline-offset-4"
							>
								{t("Reset filters")}
							</button>
						) : null}
					</div>
				) : (
					<PlayersTable data={data} />
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
