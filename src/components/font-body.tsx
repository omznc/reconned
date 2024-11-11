"use client";

import { useFont } from "@/components/font-switcher";
import { useEffect, useState, type ReactNode } from "react";

interface FontBodyProps {
	children: ReactNode;
	geistMonoVariable: string;
	geistSansVariable: string;
}

export function FontBody({
	children,
	geistMonoVariable,
	geistSansVariable,
}: FontBodyProps) {
	const { font } = useFont();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// During SSR and initial render, always use sans
	const fontVariable = mounted
		? font === "mono"
			? geistMonoVariable
			: geistSansVariable
		: geistSansVariable;

	return (
		<body
			className={`${fontVariable} antialiased min-h-dvh flex flex-col items-center justify-center`}
			suppressHydrationWarning
		>
			{children}
		</body>
	);
}
