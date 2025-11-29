"use client";

import { Square, SquareRoundCorner } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStyle } from "@/components/personalization/style/style-provider";
import { Button } from "@/components/ui/button";

export function StyleSwitcher() {
	const { style, setStyle } = useStyle();
	const t = useTranslations();

	return (
		<Button
			variant="ghost"
			onClick={() => setStyle(style === "relaxed" ? "sharp" : "relaxed")}
			suppressHydrationWarning
			className="w-full items-center justify-start cursor-pointer shadow-none"
		>
			{style === "relaxed" ? (
				<SquareRoundCorner className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			) : (
				<Square className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			)}
			{t("components.roundnessSwitcher.toggle")}
		</Button>
	);
}
