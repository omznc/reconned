"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import apiClient from "@/lib/api/api.client";
import { cn } from "@/lib/utils";

type Props = {
	/** The chosen city's id, or null for a club that names no city. */
	value: number | null;
	/**
	 * The stored display name, shown before anything is searched. The picker only
	 * ever knows the id; without this a club that already has a city would open
	 * showing a blank button until the user typed.
	 */
	initialLabel?: string | null;
	/** Restricts the search. Null for a club with no country set yet — see below. */
	countryId: number | null;
	onChange: (city: { id: number; name: string } | null) => void;
};

/** Long enough that a keystroke does not cost a request, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Picks a city out of the seeded reference table.
 *
 * The search runs server-side rather than shipping a list: there are ~148k
 * cities, and even one country's worth is more than is worth sending to fill a
 * dropdown. Results come back matched on both prefix and trigram similarity, so
 * "zivinice" finds "Živinice" and a half-typed name finds itself.
 */
export function CityCombobox({ value, initialLabel, countryId, onChange }: Props) {
	const t = useExtracted();
	const [open, setOpen] = useState(false);
	const [term, setTerm] = useState("");
	const [debouncedTerm, setDebouncedTerm] = useState("");
	// Tracks the label for whatever is currently selected. Seeded from the stored
	// name so the closed picker reads correctly on first render.
	const [label, setLabel] = useState<string | null>(initialLabel ?? null);

	useEffect(() => {
		const timeout = setTimeout(() => setDebouncedTerm(term.trim()), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timeout);
	}, [term]);

	const { data: cities = [], isFetching } = useQuery({
		queryKey: ["city-search", countryId, debouncedTerm],
		queryFn: async () => {
			const { data } = await apiClient.GET("/api/public/city-search", {
				params: {
					query: {
						q: debouncedTerm,
						// Omitted rather than sent as null for a club with no country: an
						// unfiltered search is a worse experience than a filtered one, but it
						// still finds the city, where an empty picker just blocks the user.
						...(countryId === null ? {} : { countryId }),
					},
				},
			});
			return data?.cities ?? [];
		},
		enabled: open && debouncedTerm.length > 0,
	});

	function select(city: { id: number; name: string } | null) {
		setLabel(city?.name ?? null);
		onChange(city);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn("w-full justify-between", value === null && "text-muted-foreground")}
				>
					{label ?? t("Select a city")}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-full p-0">
				{/* `shouldFilter={false}` because the server already decided what matches
				    and in what order; cmdk's own fuzzy filter would re-rank the results
				    and hide rows whose diacritics do not match what was typed. */}
				<Command shouldFilter={false}>
					<CommandInput placeholder={t("Search cities...")} value={term} onValueChange={setTerm} />
					<CommandList>
						<CommandEmpty>
							{isFetching
								? t("Searching...")
								: debouncedTerm.length === 0
									? t("Start typing to search")
									: t("No results")}
						</CommandEmpty>
						<CommandGroup>
							{value !== null && (
								<CommandItem value="__clear__" onSelect={() => select(null)}>
									{t("No city")}
								</CommandItem>
							)}
							{cities.map((city) => (
								<CommandItem
									key={city.id}
									value={String(city.id)}
									onSelect={() => select({ id: city.id, name: city.name })}
								>
									<Check
										className={cn("mr-2 h-4 w-4", city.id === value ? "opacity-100" : "opacity-0")}
									/>
									{city.name}
									{city.stateCode ? (
										<span className="ml-2 text-muted-foreground text-xs">{city.stateCode}</span>
									) : null}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
