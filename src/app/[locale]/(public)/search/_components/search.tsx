"use client";

import { Search as SearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Search() {
	const [query, setQuery] = useQueryState("q", {
		shallow: false,
		clearOnDefault: true,
		defaultValue: "",
	});
	const [, setPage] = useQueryState("page", {
		shallow: false,
		clearOnDefault: true,
	});
	const [input, setInput] = useState(query);
	const t = useExtracted();

	const handleSearch = useDebouncedCallback(async (value: string) => {
		await setQuery(value);
		await setPage(null);
	}, 300);

	return (
		<div className="relative">
			<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white dark:text-black opacity-50 pointer-events-none" />
			<Input
				value={input}
				onChange={(e) => {
					setInput(e.target.value);
					handleSearch(e.target.value);
				}}
				className={cn(
					"dark:bg-white bg-black placeholder:text-white dark:placeholder:text-black text-white dark:text-black pl-10",
				)}
				placeholder={t("Something...")}
			/>
		</div>
	);
}
