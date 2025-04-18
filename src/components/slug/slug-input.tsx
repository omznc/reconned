"use client";

import { validateSlug } from "@/components/slug/validate-slug";
import { FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useTranslations } from "next-intl";

interface SlugInputProps {
	type: "club" | "event" | "user";
	currentSlug?: string | null;
	defaultSlug?: string;
	onValid: (_: string) => void;
	// Add new prop
	onValidityChange: (_: boolean) => void;
}

export function SlugInput(props: SlugInputProps) {
	const t = useTranslations("components.slug");
	const [slug, setSlug] = useState(props.defaultSlug);
	const [debouncedSlug] = useDebounce(slug, 300);
	const [valid, setValid] = useState(false);

	useEffect(() => {
		if (!debouncedSlug || debouncedSlug === props.currentSlug) {
			return;
		}
		validateSlug({
			type: props.type,
			slug: debouncedSlug,
		}).then((resp) => {
			const valid = resp?.data ?? false;
			setValid(valid);
			props.onValidityChange(valid);
			if (valid) {
				props.onValid(debouncedSlug);
			}
		});
	}, [debouncedSlug]);

	return (
		<FormItem>
			<FormLabel>
				{t("label")}
				<span className="text-gray-500">{` ${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${props.type[0]}/${debouncedSlug ?? t("slugPlaceholder")}`}</span>
			</FormLabel>
			<FormControl>
				<Input
					defaultValue={props.defaultSlug}
					onChange={(e) => {
						const value = e.target.value
							.replace(/\s/g, "-")
							.toLowerCase()
							.replace(/[^a-z0-9-]/g, "");

						e.target.value = value;
						setSlug(value);
					}}
					className="z-10"
					placeholder={t("placeholder")}
					type="text"
				/>
			</FormControl>
			<FormDescription>
				{t("description")}{" "}
				{debouncedSlug && debouncedSlug !== props.currentSlug && (
					<span className={valid ? "text-green-500" : "text-red-500"}>
						{valid ? t("available") : t("taken")}
					</span>
				)}
			</FormDescription>
			<FormMessage />
		</FormItem>
	);
}
