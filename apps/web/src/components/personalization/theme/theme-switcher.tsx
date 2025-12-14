"use client";
import { Moon, Sun } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import apiClient from "@/lib/api";
import { useIsAuthenticated } from "@/lib/auth-client";

export function ThemeSwitcher() {
	const { theme, setTheme } = useTheme();
	const t = useExtracted();
	const { user } = useIsAuthenticated();

	useEffect(() => {
		if (theme !== "light" && theme !== "dark") {
			return;
		}

		if (!user?.id) {
			return;
		}

		if (user.theme === theme) {
			return;
		}

		apiClient.PUT("/api/users/{id}/theme", {
			params: {
				path: {
					id: user.id,
				},
			},
			body: {
				theme: theme,
			},
		});
	}, [theme, user]);

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
