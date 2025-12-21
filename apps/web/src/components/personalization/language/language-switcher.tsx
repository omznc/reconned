"use client";
import { Globe } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import posthog from "posthog-js";
import { useEffect } from "react";
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

	useEffect(() => {
		if (!VALID_LOCALES.includes(locale)) {
			return;
		}

		if (!user?.id) {
			return;
		}

		if (user.language === locale) {
			return;
		}

		apiClient.PUT("/api/users/{id}/language", {
			params: {
				path: {
					id: user.id,
				},
			},
			body: {
				language: locale,
			},
		});

		posthog.capture("preference_changed", {
			user_id: user.id,
			preference_type: "language",
			old_value: user.language,
			new_value: locale,
		});
	}, [locale, user]);

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
						onClick={async () => {
							if (localeOption !== locale) {
								router.push(path, { locale: localeOption });
								router.refresh();
							}
						}}
						className={cn(locale === localeOption && "bg-accent")}
					>
						<div className="flex items-center gap-2">
							<span>{LANGUAGE_TRANSLATIONS[localeOption]}</span>
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
