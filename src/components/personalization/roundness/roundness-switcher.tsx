"use client";

import { Square, SquareRoundCorner } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRoundness } from "@/components/personalization/roundness/roundness-provider";
import { Button } from "@/components/ui/button";

export function RoundnessSwitcher() {
	const { roundness, setRoundness } = useRoundness();
	const t = useTranslations();

	return (
		<Button
			variant="ghost"
			onClick={() => setRoundness(roundness === "relaxed" ? "sharp" : "relaxed")}
			suppressHydrationWarning
			className="w-full items-center justify-start cursor-pointer shadow-none"
		>
			{roundness === "relaxed" ? (
				<SquareRoundCorner className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			) : (
				<Square className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			)}
			{t("components.roundnessSwitcher.toggle")}
		</Button>
	);
}
