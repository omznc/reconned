"use client";
import { Button } from "@/components/ui/button";
import { LANGUAGE_TRANSLATIONS, VALID_LOCALES } from "@/i18n/valid-locales";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Globe } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
	const t = useTranslations("components.languageSwitcher");
	const router = useRouter();
	const path = usePathname();
	const locale = useLocale();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					suppressHydrationWarning
					className="w-full items-center justify-start cursor-pointer"
				>
					<Globe className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
					{LANGUAGE_TRANSLATIONS[locale as keyof typeof LANGUAGE_TRANSLATIONS]}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuLabel>{t("select")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{VALID_LOCALES.map((localeOption) => (
					<DropdownMenuItem
						key={localeOption}
						onClick={() =>
							localeOption !== locale
								? router.replace(path, { locale: localeOption })
								: null
						}
						className={locale === localeOption ? "bg-accent" : ""}
					>
						<div className="flex items-center gap-2">
							<span>{LANGUAGE_TRANSLATIONS[localeOption]}</span>
							{localeOption === "en" && (
								<span className="text-xs text-muted-foreground">
									In progress
								</span>
							)}
						</div>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
