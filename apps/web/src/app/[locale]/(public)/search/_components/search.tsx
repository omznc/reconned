"use client";

import { Calendar, Filter, Search as SearchIcon, Shield, Users } from "lucide-react";
import { useExtracted } from "next-intl";
import { parseAsBoolean, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function Search() {
	const [query, setQuery] = useQueryState("q", {
		shallow: false,
		clearOnDefault: true,
		defaultValue: "",
	});
	const [filterClubs, setFilterClubs] = useQueryState("filterClubs", parseAsBoolean.withDefault(true));
	const [filterUsers, setFilterUsers] = useQueryState("filterUsers", parseAsBoolean.withDefault(true));
	const [filterEvents, setFilterEvents] = useQueryState("filterEvents", parseAsBoolean.withDefault(true));
	const [input, setInput] = useState(query || "");
	const [open, setOpen] = useState(false);
	const t = useExtracted();

	useEffect(() => {
		setInput(query || "");
	}, [query]);

	const handleSearch = useDebouncedCallback(async (value: string) => {
		if (value.length >= 2 || value.length === 0) {
			await setQuery(value || null);
		}
	}, 300);

	const activeFiltersCount = [filterClubs, filterUsers, filterEvents].filter(Boolean).length;

	return (
		<div className="space-y-2">
			<div className="relative">
				<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white dark:text-black opacity-50 pointer-events-none" />
				<Input
					value={input}
					onChange={(e) => {
						const value = e.target.value;
						setInput(value);
						handleSearch(value);
					}}
					className={cn(
						"dark:bg-white bg-black placeholder:text-white dark:placeholder:text-black text-white dark:text-black pl-10 pr-10",
					)}
					placeholder={t("Something...")}
				/>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className={cn(
								"absolute right-1 top-1/2 -translate-y-1/2 size-8 bg-black dark:bg-white text-white dark:text-black transition-all",
							)}
						>
							<Filter className="size-4" />
							{activeFiltersCount < 3 && (
								<span className="absolute -top-1 -right-1 size-2 bg-red-500 rounded-full" />
							)}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-64" align="end">
						<div className="space-y-4">
							<div className="space-y-2">
								<Label className="text-sm font-medium">{t("Filters")}</Label>
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<Label
											htmlFor="filter-clubs"
											className="flex items-center gap-2 cursor-pointer flex-1"
										>
											<Shield className="h-4 w-4" />
											{t("Clubs")}
										</Label>
										<Switch
											id="filter-clubs"
											checked={filterClubs || true}
											onCheckedChange={(checked) => {
												setFilterClubs(!!checked);
											}}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label
											htmlFor="filter-users"
											className="flex items-center gap-2 cursor-pointer flex-1"
										>
											<Users className="h-4 w-4" />
											{t("Players")}
										</Label>
										<Switch
											id="filter-users"
											checked={filterUsers || true}
											onCheckedChange={(checked) => {
												setFilterUsers(!!checked);
											}}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label
											htmlFor="filter-events"
											className="flex items-center gap-2 cursor-pointer flex-1"
										>
											<Calendar className="h-4 w-4" />
											{t("Events")}
										</Label>
										<Switch
											id="filter-events"
											checked={filterEvents || true}
											onCheckedChange={(checked) => {
												setFilterEvents(!!checked);
											}}
										/>
									</div>
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</div>
			{input.length > 0 && input.length < 2 && (
				<p className="text-sm text-muted-foreground">{t("Enter at least 2 characters to search")}</p>
			)}
		</div>
	);
}
