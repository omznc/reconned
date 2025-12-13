"use client";

import { Type } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect } from "react";
import { useFont } from "@/components/personalization/font/font-provider";
import { Button } from "@/components/ui/button";
import { setFontAction } from "@/lib/global-actions/font";

export function FontSwitcher() {
	const { font, setFont } = useFont();
	const t = useExtracted();

	useEffect(() => {
		if (font !== "sans" && font !== "mono") {
			return;
		}

		setFontAction({
			font: font,
		});
	}, [font]);

	return (
		<Button
			variant="ghost"
			onClick={() => setFont(font === "sans" ? "mono" : "sans")}
			suppressHydrationWarning
			className="w-full items-center justify-start cursor-pointer shadow-none"
		>
			<Type className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
			{t("Change font")}
		</Button>
	);
}
