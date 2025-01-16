"use client";

import {
	FormItem,
	FormLabel,
	FormControl,
	FormDescription,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

interface SlugInputProps {
	type: "club" | "event" | "user";
	currentSlug?: string | null;
	defaultSlug?: string;
	onValid: (_: string) => void;
	// Add new prop
	onValidityChange: (_: boolean) => void;
}

export function SlugInput(props: SlugInputProps) {
	const [slug, setSlug] = useState(props.defaultSlug);
	const [debouncedSlug] = useDebounce(slug, 300);
	const [valid, setValid] = useState(false);

	useEffect(() => {
		if (!debouncedSlug || debouncedSlug === props.currentSlug) {
			return;
		}
		fetch(`/api/slug?type=${props.type}&slug=${debouncedSlug}`).then((res) => {
			if (res.ok) {
				setValid(true);
				props.onValid(debouncedSlug);
				props.onValidityChange(true);
				return;
			}
			setValid(false);
			props.onValidityChange(false);
		});
	}, [debouncedSlug]);

	return (
		<FormItem>
			<FormLabel>
				Specijalni link
				<span className="text-gray-500">{` ${env.NEXT_PUBLIC_BETTER_AUTH_URL}/${props.type[0]}/${debouncedSlug}`}</span>
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
					placeholder="moj-link"
					type="text"
				/>
			</FormControl>
			<FormDescription>
				Kratki link koji ćete moći podjeliti.{" "}
				{debouncedSlug && debouncedSlug !== props.currentSlug && (
					<span className={valid ? "text-green-500" : "text-red-500"}>
						{valid ? "Link je dostupan." : "Link je zauzet!"}
					</span>
				)}
			</FormDescription>
			<FormMessage />
		</FormItem>
	);
}
