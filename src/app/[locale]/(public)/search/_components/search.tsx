"use client";

import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Input } from "@/components/ui/input";

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
		<Input
			value={input}
			onChange={(e) => {
				setInput(e.target.value);
				handleSearch(e.target.value);
			}}
			className="dark:bg-white bg-black placeholder:text-black dark:placeholder:text-white text-white dark:text-black"
			placeholder={t("Something...")}
		/>
	);
}
