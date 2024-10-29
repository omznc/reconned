"use client";

import { Button } from "@/components/ui/button";
import { useState, type HTMLAttributes } from "react";

export function LoadChildOnClick(props: HTMLAttributes<HTMLDivElement>) {
	const [isLoaded, setIsLoaded] = useState(false);

	if (isLoaded) {
		return props.children;
	}
	return (
		<div
			className="w-full h-[200px] flex items-center justify-center border bg-sidebar"
			onClick={() => setIsLoaded(true)}
			{...props}
		>
			<Button>{props.title}</Button>
		</div>
	);
}
