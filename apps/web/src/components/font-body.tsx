"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useFont } from "@/components/personalization/font/font-provider";
import { cn } from "@/lib/utils";

interface FontBodyProps {
	children: ReactNode;
	geistMonoVariable: string;
	geistSansVariable: string;
}

export function FontBody({ children, geistMonoVariable, geistSansVariable }: FontBodyProps) {
	const { font } = useFont();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// During SSR and initial render, always use sans
	const fontVariable = mounted ? (font === "mono" ? geistMonoVariable : geistSansVariable) : geistSansVariable;

	return (
		<body
			className={cn(fontVariable, "antialiased min-h-dvh flex flex-col items-center justify-center")}
			suppressHydrationWarning
		>
			{children}
		</body>
	);
}
