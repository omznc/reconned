"use client";

import { useLanguage } from "@/components/personalization/language/language-provider";
import { setLanguageAction } from "@/lib/global-actions/language";
import { useEffect } from "react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@/components/ui/select";
import { LANGUAGE_TRANSLATIONS, VALID_LOCALES } from "@/i18n/valid-locales";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSwitcher() {
	const { language, setLanguage } = useLanguage();
	const t = useTranslations("components.languageSwitcher");
	const router = useRouter();

	useEffect(() => {
		console.log("LanguageSwitcher", language);
		if (!VALID_LOCALES.includes(language as (typeof VALID_LOCALES)[number])) {
			return;
		}
		document.cookie = `preferred-language=${language};path=/;max-age=31536000`;

		setLanguageAction({
			language: language,
		});
		router.refresh();
	}, [language]);

	return (
		<Select value={language} onValueChange={setLanguage}>
			<SelectTrigger className="w-fit">
				<span className="mr-2">
					{LANGUAGE_TRANSLATIONS[
						language as keyof typeof LANGUAGE_TRANSLATIONS
					] ?? "🌐"}
				</span>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>{t("select")}</SelectLabel>
				</SelectGroup>
				{VALID_LOCALES.map((locale) => (
					<SelectItem key={locale} value={locale}>
						<div className="flex flex-col">
							{LANGUAGE_TRANSLATIONS[locale]}
							{locale === 'en' && <span className="text-muted-foreground">In progress</span>}
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
