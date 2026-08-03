"use client";

import { type HTMLAttributes, useState } from "react";
import { Button } from "@/components/ui/button";

export function LoadChildOnClick(props: HTMLAttributes<HTMLDivElement>) {
	const [isLoaded, setIsLoaded] = useState(false);

	if (isLoaded) {
		return props.children;
	}
	// One control, not two: the wrapper used to be a role="button" div with a real Button inside it,
	// which produced two tab stops where only the inner one was keyboard-operable.
	return (
		<div className="w-full h-[200px] flex items-center rounded-md justify-center border bg-sidebar" {...props}>
			<Button type="button" onClick={() => setIsLoaded(true)}>
				{props.title}
			</Button>
		</div>
	);
}
