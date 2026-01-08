"use client";
import { Globe } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LANGUAGE_TRANSLATIONS, VALID_LOCALES } from "@/i18n/valid-locales";
import apiClient from "@/lib/api/api.client";
import { useIsAuthenticated } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface LanguageSwitcherProps extends ButtonProps {}
export function LanguageSwitcher({ className, variant, ...props }: LanguageSwitcherProps) {
	const t = useExtracted();
	const router = useRouter();
	const path = usePathname();
	const locale = useLocale();
	const { user } = useIsAuthenticated();
	const [isChanging, setIsChanging] = useState(false);

	useEffect(() => {
		// Validate locale
		if (!VALID_LOCALES.includes(locale)) {
			return;
		}

		// Only update if user is authenticated
		if (!user?.id) {
			return;
		}

		// Skip if locale matches user's current language
		if (user.language === locale) {
			return;
		}

		// Immediately persist to localStorage as fallback
		if (typeof window !== "undefined") {
			localStorage.setItem("user-language-preference", locale);
		}

		// Update language preference immediately
		const updateLanguage = async () => {
			try {
				const { error } = await apiClient.PUT("/api/users/{id}/language", {
					params: {
						path: {
							id: user.id,
						},
					},
					body: {
						language: locale,
					},
				});

				if (error) {
					throw new Error(error.error || "Failed to update language preference");
				}

				posthog.capture("preference_changed", {
					user_id: user.id,
					preference_type: "language",
					old_value: user.language,
					new_value: locale,
				});
			} catch (error) {
				console.error("Failed to update language preference:", error);
				// Don't show toast for language changes as it might be confusing
			}
		};

		updateLanguage();
	}, [locale, user]);

	const handleLanguageChange = async (localeOption: string) => {
		if (localeOption === locale) {
			return;
		}

		setIsChanging(true);
		try {
			router.push(path, { locale: localeOption });
			// Give the router time to update before refreshing
			setTimeout(() => {
				router.refresh();
				setIsChanging(false);
			}, 100);
		} catch (error) {
			console.error("Failed to change language:", error);
			toast.error(t("Failed to change language. Please try again."));
			setIsChanging(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant={variant || "ghost"}
					suppressHydrationWarning
					className={cn("items-center w-full justify-start cursor-pointer shadow-none", className)}
					{...props}
				>
					<Globe className="h-[1.2rem] w-[1.2rem] rotate-0 ml-2 scale-100 transition-all" />
					{LANGUAGE_TRANSLATIONS[locale as keyof typeof LANGUAGE_TRANSLATIONS]}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{t("Choose a language")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{VALID_LOCALES.map((localeOption) => (
					<DropdownMenuItem
						key={localeOption}
						onClick={() => handleLanguageChange(localeOption)}
						className={cn(locale === localeOption && "bg-accent")}
						disabled={isChanging}
					>
						<div className="flex items-center gap-2">
							<span>{LANGUAGE_TRANSLATIONS[localeOption]}</span>
							{locale === localeOption && <span className="ml-auto">✓</span>}
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
