"use client";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@/components/ui/select";
import { LANGUAGE_TRANSLATIONS, VALID_LOCALES } from "@/i18n/valid-locales";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LanguageSwitcher() {
	const t = useTranslations("components.languageSwitcher");
	const router = useRouter();
	const path = usePathname();
	const locale = useLocale();

	return (
		<Select
			value={locale}
			onValueChange={(value) => {
				router.replace(path, { locale: value });
			}}
		>
			<SelectTrigger className="w-fit">
				<span className="mr-2">
					{LANGUAGE_TRANSLATIONS[
						locale as keyof typeof LANGUAGE_TRANSLATIONS
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
							{locale === "en" && (
								<span className="text-muted-foreground">In progress</span>
							)}
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
