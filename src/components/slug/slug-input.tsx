"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { validateSlug } from "@/components/slug/validate-slug";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

interface SlugInputProps {
	type: "club" | "event" | "user";
	currentSlug?: string | null;
	defaultSlug?: string;
	onValid: (_: string) => void;
	onValidityChange: (_: boolean) => void;
}

export function SlugInput(props: SlugInputProps) {
	const t = useTranslations();
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
				{t("components.slug.label")}
				<span className="text-gray-500">{` ${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${props.type[0]}/${debouncedSlug ?? t("components.slug.slugPlaceholder")}`}</span>
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
					placeholder={t("components.slug.placeholder")}
					type="text"
				/>
			</FormControl>
			<FormDescription>
				{t("components.slug.description")}{" "}
				{debouncedSlug && debouncedSlug !== props.currentSlug && (
					<span className={cn(valid && "text-green-500", !valid && "text-red-500")}>
						{valid ? t("components.slug.available") : t("components.slug.taken")}
					</span>
				)}
			</FormDescription>
			<FormMessage />
		</FormItem>
	);
}
