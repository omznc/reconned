"use client";

import { type HTMLAttributes, useState } from "react";
import { Button } from "@/components/ui/button";

export function LoadChildOnClick(props: HTMLAttributes<HTMLDivElement>) {
	const [isLoaded, setIsLoaded] = useState(false);

	if (isLoaded) {
		return props.children;
	}
	return (
		// biome-ignore lint/a11y/useSemanticElements: Style stuff
		<div
			role="button"
			tabIndex={0}
			className="w-full h-[200px] flex items-center rounded-md justify-center border bg-sidebar"
			onClick={() => setIsLoaded(true)}
			{...props}
		>
			<Button>{props.title}</Button>
		</div>
	);
}
