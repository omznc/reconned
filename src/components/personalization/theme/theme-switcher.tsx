"use client";
import { Moon, Sun } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { setThemeAction } from "@/lib/global-actions/theme";

export function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const t = useExtracted();

	useEffect(() => {
		if (theme !== "light" && theme !== "dark") {
			return;
		}

		setThemeAction({
			theme: theme,
		});
	}, [theme]);

	return (
		<Button
			variant="ghost"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			suppressHydrationWarning
			className="w-full items-center justify-start cursor-pointer shadow-none"
		>
			<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
			{t("Change theme")}
		</Button>
	);
}
