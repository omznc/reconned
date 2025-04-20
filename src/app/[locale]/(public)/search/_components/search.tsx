"use client";

import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

export function Search() {
	const [query, setQuery] = useQueryState("q", {
		shallow: false,
		clearOnDefault: true,
		defaultValue: "",
	});
	const [input, setInput] = useState(query);
	const t = useTranslations("public.search");

	const handleSearch = useDebouncedCallback((value: string) => {
		setQuery(value);
	}, 300);

	return (
		<Input
			value={input}
			onChange={(e) => {
				setInput(e.target.value);
				handleSearch(e.target.value);
			}}
			placeholder={t("placeholder")}
		/>
	);
}
