import { Calendar, Search, Shield, Users, X } from "lucide-react";
import { useExtracted } from "next-intl";
import { type FormEvent, type RefObject, useEffect, useRef } from "react";
import { ProfileTabs } from "@/components/redesign/profile-tabs";
import { useDebouncedSearch } from "@/components/redesign/use-debounced-search";
import { Button } from "@/components/ui/button";
import { ClubHit, EventHit, HitSection, PlayerHit } from "@/routes/{-$locale}/_public/search/-components/search-hits";
import { RefineDisclosure, SearchSidebar } from "@/routes/{-$locale}/_public/search/-components/search-sidebar";
import {
	type SearchParams,
	type SearchTab,
	searchHref,
	useRecentSearches,
	useSearchParams,
} from "@/routes/{-$locale}/_public/search/-components/search-state";
import { TopResult } from "@/routes/{-$locale}/_public/search/-components/search-top-result";
import {
	useSearchSections,
	useSearchSummary,
	useSearchTab,
} from "@/routes/{-$locale}/_public/search/-components/use-search-data";

function SearchBox({
	query,
	onType,
	onSubmit,
	inputRef,
}: {
	query: string;
	onType: (value: string) => void;
	onSubmit: (value: string) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
}) {
	const t = useExtracted();
	const { value, onChange: setValue } = useDebouncedSearch(query, onType);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		onSubmit(value.trim());
	};

	return (
		<search>
			<form
				onSubmit={submit}
				className="flex h-14 items-center gap-2 rounded-lg border border-brand/40 bg-card pr-2 pl-4 shadow-[0_0_0_4px_hsl(var(--brand)/0.08)] focus-within:border-brand"
			>
				<Search className="size-5 shrink-0 text-muted-foreground" aria-hidden={true} />
				<label htmlFor="search-input" className="sr-only">
					{t("Search")}
				</label>
				<input
					id="search-input"
					ref={inputRef}
					type="text"
					value={value}
					maxLength={100}
					autoComplete="off"
					placeholder={t("Clubs, events, players…")}
					onChange={(event) => setValue(event.target.value)}
					className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
				/>
				{value ? (
					<button
						type="button"
						aria-label={t("Clear search")}
						onClick={() => {
							setValue("");
							inputRef.current?.focus();
						}}
						className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						<X className="size-4" aria-hidden={true} />
					</button>
				) : null}
				<Button type="submit">{t("Search")}</Button>
			</form>
		</search>
	);
}

function Tabs({ params, counts }: { params: SearchParams; counts?: { events: number; clubs: number; users: number } }) {
	const t = useExtracted();
	const all = counts ? counts.events + counts.clubs + counts.users : null;
	const tab = (key: SearchTab, label: string, count: number | null) => ({
		key,
		label,
		count,
		href: searchHref(params, { tab: key }),
	});
	return (
		<ProfileTabs
			label={t("Result types")}
			activeKey={params.tab}
			tabs={[
				tab("all", t("All"), all),
				tab("events", t("Events"), counts?.events ?? null),
				tab("clubs", t("Clubs"), counts?.clubs ?? null),
				tab("players", t("Players"), counts?.users ?? null),
			]}
		/>
	);
}

function EmptyState({ query }: { query: string }) {
	const t = useExtracted();
	return (
		<div className="rounded-lg border bg-card px-6 py-12 text-center" role="status">
			<p className="font-medium">{query ? t("No results for “{query}”", { query }) : t("No results")}</p>
			<p className="mt-1 text-sm text-muted-foreground">
				{t("Try a shorter term, or change the refine filters.")}
			</p>
		</div>
	);
}

function ErrorState() {
	const t = useExtracted();
	return (
		<div className="py-16 text-center text-destructive" role="alert">
			{t("Unable to load search results. Check your connection and try again.")}
		</div>
	);
}

function AllSections({
	params,
	counts,
}: {
	params: SearchParams;
	counts: { events: number; clubs: number; users: number };
}) {
	const t = useExtracted();
	const { data } = useSearchSections(params);
	if (!data) {
		return null;
	}
	return (
		<>
			{data.events.length > 0 ? (
				<HitSection
					icon={Calendar}
					title={t("Events")}
					allLabel={t("All {count} events", { count: String(counts.events) })}
					params={params}
					tab="events"
				>
					{data.events.map((item) => (
						<EventHit key={item.id} item={item} />
					))}
				</HitSection>
			) : null}
			{data.clubs.length > 0 ? (
				<HitSection
					icon={Shield}
					title={t("Clubs")}
					allLabel={t("All {count} clubs", { count: String(counts.clubs) })}
					params={params}
					tab="clubs"
					columns={true}
				>
					{data.clubs.map((item) => (
						<ClubHit key={item.id} item={item} />
					))}
				</HitSection>
			) : null}
			{data.users.length > 0 ? (
				<HitSection
					icon={Users}
					title={t("Players")}
					allLabel={t("All {count} players", { count: String(counts.users) })}
					params={params}
					tab="players"
					columns={true}
				>
					{data.users.map((item) => (
						<PlayerHit key={item.id} item={item} />
					))}
				</HitSection>
			) : null}
		</>
	);
}

function TabResults({ params }: { params: SearchParams }) {
	const t = useExtracted();
	const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSearchTab(params);
	const items = data?.pages.flatMap((page) => page.items) ?? [];
	return (
		<>
			<div className={params.tab === "events" ? "flex flex-col gap-2" : "grid grid-cols-1 gap-2 xl:grid-cols-2"}>
				{items.map((item) => {
					if (item.type === "event") {
						return <EventHit key={item.id} item={item} />;
					}
					return item.type === "club" ? (
						<ClubHit key={item.id} item={item} />
					) : (
						<PlayerHit key={item.id} item={item} />
					);
				})}
			</div>
			{hasNextPage ? (
				<Button
					type="button"
					variant="secondary"
					className="self-center"
					disabled={isFetchingNextPage}
					onClick={() => fetchNextPage()}
				>
					{t("Show more")}
				</Button>
			) : null}
		</>
	);
}

/** Arrow keys move between the result links. Enter opens the focused link. */
function moveFocus(event: KeyboardEvent, input: HTMLElement | null, root: HTMLElement | null) {
	const active = document.activeElement;
	const fromInput = active === input;
	if ((event.key !== "ArrowDown" && event.key !== "ArrowUp") || !root || !(fromInput || root.contains(active))) {
		return;
	}
	const links = Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]"));
	const index = links.findIndex((link) => link === active);
	if (fromInput && event.key === "ArrowUp") {
		return;
	}
	const target = links[Math.max(0, Math.min(event.key === "ArrowDown" ? index + 1 : index - 1, links.length - 1))];
	if (target) {
		event.preventDefault();
		target.focus();
	}
}

/** `/` focuses the search box. The arrow keys move between the results. */
function useSearchKeys(inputRef: RefObject<HTMLInputElement | null>, resultsRef: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement;
			const typing = target.matches("input, textarea, select, [contenteditable]");
			if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
				event.preventDefault();
				inputRef.current?.focus();
				return;
			}
			moveFocus(event, inputRef.current, resultsRef.current);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [inputRef, resultsRef]);
}

export function SearchPage() {
	const t = useExtracted();
	const [params, setParams] = useSearchParams();
	const { recent, add, clear } = useRecentSearches();
	const inputRef = useRef<HTMLInputElement>(null);
	const resultsRef = useRef<HTMLDivElement>(null);
	const summary = useSearchSummary(params);
	const counts = summary.data?.counts;
	const total = counts ? counts.events + counts.clubs + counts.users : null;

	useSearchKeys(inputRef, resultsRef);

	const typeQuery = (q: string) => {
		setParams({ q }, { shallow: false });
	};
	// Only a submitted or opened search goes to the recent list, not each pause while typing.
	const setQuery = (q: string) => {
		add(q);
		typeQuery(q);
	};
	const rememberOnOpen = (event: React.MouseEvent) => {
		if (params.q && (event.target as HTMLElement).closest("a[href]")) {
			add(params.q);
		}
	};
	const refine = (patch: Partial<SearchParams>) => {
		setParams(patch);
	};

	return (
		<div className="container flex max-w-6xl flex-col gap-5 px-4 py-6">
			<h1 className="sr-only">{t("Search")}</h1>
			<SearchBox query={params.q} onType={typeQuery} onSubmit={setQuery} inputRef={inputRef} />
			<Tabs params={params} counts={counts} />
			<p className="sr-only" role="status" aria-live="polite">
				{total === null ? "" : t("{count} results", { count: String(total) })}
			</p>
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
				{/* biome-ignore lint/a11y/noStaticElementInteractions: the click only notes which search led to an opened result; the links stay the controls. */}
				<div ref={resultsRef} onClick={rememberOnOpen} className="flex min-w-0 flex-col gap-6">
					<RefineDisclosure params={params} onChange={refine} />
					{summary.isError ? <ErrorState /> : null}
					{total === 0 ? <EmptyState query={params.q} /> : null}
					{params.tab === "all" && summary.data?.topResult && params.q ? (
						<TopResult item={summary.data.topResult} />
					) : null}
					{counts && total !== 0 && params.tab === "all" ? (
						<AllSections params={params} counts={counts} />
					) : null}
					{params.tab !== "all" && total !== 0 ? <TabResults params={params} /> : null}
				</div>
				<SearchSidebar
					params={params}
					onChange={refine}
					recent={recent}
					onPickRecent={setQuery}
					onClearRecent={clear}
				/>
			</div>
		</div>
	);
}
