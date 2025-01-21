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
import { VALID_LOCALES } from "@/i18n/valid-locales";
import { useTranslations } from "next-intl";

type LanguageSwitcherProps = {
	countries: {
		id: number;
		name: string;
		emoji: string;
		iso2: string;
	}[];
};
export function LanguageSwitcher(props: LanguageSwitcherProps) {
	const { language, setLanguage } = useLanguage();
	const t = useTranslations("components.languageSwitcher");

	useEffect(() => {
		if (!VALID_LOCALES.includes(language)) {
			return;
		}

		localStorage.setItem("preferred-language", language);

		setLanguageAction({
			language: language,
		});
	}, [language]);

	const selectedCountry = props.countries.find(
		(country) => country.iso2.toLocaleLowerCase() === language,
	);

	if (VALID_LOCALES.length <= 1) {
		return null;
	}

	return (
		<Select value={language} onValueChange={setLanguage}>
			<SelectTrigger className="w-fit">
				<span className="mr-2 text-lg">{selectedCountry?.emoji}</span>
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>{t("select")}</SelectLabel>
				</SelectGroup>
				{props.countries
					.filter((country) =>
						VALID_LOCALES.includes(country.iso2.toLowerCase()),
					)
					.map((country) => (
						<SelectItem
							key={country.iso2.toLowerCase()}
							value={country.iso2.toLowerCase()}
						>
							{country.emoji ? (
								<span className="mr-2 text-lg">{country.emoji}</span>
							) : (
								<span className="mr-2 text-lg">🏳️</span> // Fallback emoji
							)}
							{country.name}
						</SelectItem>
					))}
			</SelectContent>
		</Select>
	);
}
